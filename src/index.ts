/**
MIT License

Copyright (c) 2022 Maximilien Zaleski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import React from 'react';

/** IUsePageContentNavigationOptions represents the hook's configuration options. */
export interface IUsePageContentNavigationOptions {
  /** Whether to enable the hook. */
  enabled?: boolean;
  /**
   * The viewport's boundary as a float. In other words, where the hook will evaluate a
   * section's visibility.
   *
   * Lets assume that the boundary is set at `0.3`,
   * the hook will evaluate whether the section is between 30% and 70% (1-0.3) of the viewport.
   *
   * @default
   * 0.3
   */
  viewportBoundary?: number;
  /**
   * How many pixels to offset the boundary.
   *
   * A fixed header of `92px` with a content margin of `48px` would result in an offset of `140px`.
   */
  contentTopOffset?: number;
  /**
   * Represents the component property that dictates the section's title.
   *
   * @default
   * "title"
   */
  sectionTitlePropName?: string;
  /**
   * If the `sectionTitlePropName` is set but on a child element such as a modularity-motivated
   * header, then this option enables a single-level dive in order to retrieve it.
   *
   * For example:
   * `<Section header={<Header title="My Title" />} />`
   *
   * Props:
   * - `sectionTitlePropName`: "title"
   * - `diveByPropName`: "header"
   */
  diveByPropName?: string;
}

/** IUsePageContentNavigationItem represents a navigation item produced by the hook. */
export interface IUsePageContentNavigationItem {
  /** The item's display value. */
  label: string;
  /** The item's DOM identifier. */
  scrollTo: string;
}

/** IUsePageContentNavigationState represents the hook's exported state. */
export interface IUsePageContentNavigationState {
  /** The current content index. */
  currentIndex: number;
  /** The links representative of the page content. */
  navItems: IUsePageContentNavigationItem[];
  /**
   * The actual content mutated to include missing DOM identifiers. These should be rendered over
   * the initial `children` prop.
   */
  mutatedChildren: React.ReactNode;
  /** Setter for `currentIndex`. */
  setCurrentIndex(index: number): void;
}

/**
 * usePageContentNavigation is a hook that enables dynamic content navigation based on the scroll
 * state.
 *
 * @param children The content sections to be navigated.
 * @param opts The hook's configuration options.
 */
export function usePageContentNavigation(
  children: React.ReactNode,
  {
    viewportBoundary = 0.3,
    contentTopOffset = 0,
    sectionTitlePropName = 'title',
    enabled = true,
    diveByPropName,
  }: IUsePageContentNavigationOptions
): IUsePageContentNavigationState {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [previousScrollTop, setPreviousScrollTop] = React.useState(0);
  const [childrenAsReactElement, setChildrenAsReactElement] = React.useState(
    (children instanceof Array
      ? [...children]
      : [children]) as React.ReactElement[]
  );
  const [navItems, setNavItems] = React.useState<
    IUsePageContentNavigationItem[]
  >([]);

  if (viewportBoundary < 0 || viewportBoundary > 1)
    throw new ViewportBoundaryError();

  const handleScroll = React.useCallback(
    (e: Event) => {
      e.preventDefault();

      // [scrollbar: at the top]
      if (window.scrollY === 0) setCurrentIndex(0);
      // [scrollbar: at the bottom]
      else if (
        window.scrollY + window.innerHeight ===
        document.body.scrollHeight
      )
        setCurrentIndex(navItems.length - 1);
      // [scrollbar: neither extreme]
      else if (navItems.length) {
        const scrollDirection =
          window.scrollY < previousScrollTop ? 'up' : 'down';

        // Guard to prevent a runtime error resulting from the `currentIndex` being set to an
        // extreme. This can happen when the setter is called from outside the hook.
        if (
          (scrollDirection === 'up' && currentIndex > 0) ||
          (scrollDirection === 'down' && currentIndex < navItems.length - 1)
        ) {
          // Look at either the next or previous section.
          const id =
            navItems[currentIndex + (scrollDirection === 'up' ? -1 : 1)]
              .scrollTo;
          const selectedRect = document.getElementById(id) as HTMLElement;
          // [scrolling: downwards]
          if (
            scrollDirection === 'down' &&
            selectedRect.offsetTop - window.scrollY - contentTopOffset <=
              window.innerHeight * viewportBoundary - contentTopOffset
          )
            setCurrentIndex(currentIndex + 1);
          // [scrolling: upwards]
          else if (
            scrollDirection === 'up' &&
            selectedRect.getBoundingClientRect().bottom >=
              window.innerHeight * (1 - viewportBoundary)
          )
            setCurrentIndex(currentIndex - 1);
        }
      }

      setPreviousScrollTop(window.scrollY);
    },
    [currentIndex, previousScrollTop, navItems]
  );

  // [setup] Scroll listener.
  React.useEffect(() => {
    if (!enabled) return;

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // [setup] items & children mutation.
  React.useEffect(() => {
    if (!enabled) return;

    // Validate the children as we cannot allow any outlier as the hook won't behave properly due to
    // the nature of its at-extreme logic.
    childrenAsReactElement.forEach((child, index) => {
      // If the dive flag is set, dive into the child's props;
      // otherwise, check for the prop directly.
      const element = diveByPropName ? child.props[diveByPropName] : child;
      if (!element || typeof element.props[sectionTitlePropName] !== 'string')
        throw new SectionTitlePropError(index, sectionTitlePropName);
    });
    // Map the filtered elements to recognisable links.
    const items = childrenAsReactElement.map<IUsePageContentNavigationItem>(
      ({ props }) => {
        const title = props[sectionTitlePropName];
        return {
          label: title,
          scrollTo:
            props.id || title.toLowerCase().replaceAll(' ', '-') + '-section',
        };
      }
    );
    setNavItems(items);

    // Mutate the children to include missing DOM identifiers.
    // The use of `forEach` is preferred over `map` as it allows for the initial React keys to be
    // preserved.
    const mutatedChildren: React.ReactElement[] = [];
    childrenAsReactElement.forEach((child, index) => {
      let addition = child;
      if (!child.props.id) {
        addition = React.cloneElement(addition, { id: items[index].scrollTo });
      }
      mutatedChildren.push(addition);
    });
    setChildrenAsReactElement(mutatedChildren);
  }, [children, enabled]);

  const setCurrentIndexExported = React.useCallback(
    (index: number) => {
      if (index < 0 || index >= navItems.length) throw new IndexOutOfBoundsError(index);
      setCurrentIndex(index);
    },
    [navItems]
  );

  return {
    currentIndex,
    navItems,
    mutatedChildren: childrenAsReactElement,
    setCurrentIndex: setCurrentIndexExported,
  };
}

/**
 * SectionTitlePropError is thrown when the `sectionTitlePropName` is not available on the source
 * element.
 */
export class SectionTitlePropError extends Error {
  constructor(index: number, propName: string) {
    super(
      `[usePageContentNavigation] Element at [${index}] does not have the '${propName}' prop.`
    );
    this.name = 'SectionTitlePropError';
  }
}

/** ViewportBoundaryError is thrown when the `viewportBoundary` option is invalid. */
export class ViewportBoundaryError extends Error {
  constructor() {
    super(
      '[usePageContentNavigation] `viewportBoundary` must be a float between 0 and 1.'
    );
    this.name = 'ViewportBoundaryError';
  }
}

/** IndexOutOfBoundsError is thrown when `setCurrentIndex` receives an invalid value. */
export class IndexOutOfBoundsError extends Error {
  constructor(index: number) {
    super(`[usePageContentNavigation] Index '${index}' is out of bounds.`);
    this.name = 'IndexOutOfBoundsError';
  }
}
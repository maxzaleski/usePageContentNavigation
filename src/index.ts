import React from 'react';

export interface IUsePageContentNavigationOptions {
  /** Whether to enable the hook. */
  enabled?: boolean;

  /**
   * The viewport's boundary as float values. In other words,
   * where the hook will evaluate a section's visibility.
   *
   * The default value is 0.3.
   *
   * e.g. Lets assume that the boundary is set at 0.3,
   * the hook will evaluate whether the section is between 30% and (1 - 0.3) 70%
   * of the viewport.
   */
  viewportBoundary?: number;
  /**
   * How many pixels to offset the boundary.
   *
   * e.g. a fixed header of 92px with a content margin of 48px would result in an
   * offset of 140px.
   * */
  contentTopOffset?: number;

  /** Represents the component prop. that dictates the section's title. */
  sectionTitleProp: string;
  /**
   * If the `sectionTitleProp` is set but on a child element such as a
   * modularity-motivated header, then this option enables a single-level dive
   * in order to retrieve it.
   *
   * @example
   * <Section header={<Header title="My Title" />} />
   *
   * Options:
   * ↳ sectionTitleProp: "title"
   * ↳ nestedSectionProp: "header"
   */
  nestedSectionProp?: string;
}

export interface IUsePageContentNavigationLink {
  /** The link's display value. */
  label: string;
  /** The link's DOM id. */
  scrollTo: string;
}

export interface IUsePageContentNavigationResult {
  /** The current content index. */
  currentIndex: number;
  /** The links representative of the page content. */
  contentLinks: IUsePageContentNavigationLink[];
  /**
   * If your content sections did not have a DOM ID assigned to them prior to
   * this hook, you will need to render these as opposed to the original.
   */
  mutatedChildren: React.ReactNode;

  /** Setter for `currentIndex`. */
  setCurrentIndex(index: number): void;
}

/**
 * usePageContentNavigation is a hook that enables dynamic content navigation
 * based on the scroll state.
 *
 * @param children The content sections to be navigated.
 * @param options The configuration options for the hook.
 */
export function usePageContentNavigation(
  children: React.ReactNode,
  {
    enabled,

    viewportBoundary = 0.3,
    contentTopOffset = 0,

    sectionTitleProp,
    nestedSectionProp,
  }: IUsePageContentNavigationOptions
): IUsePageContentNavigationResult {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [previousScrollTop, setPreviousScrollTop] = React.useState(0);
  const [childrenAsReactElement, setChildrenAsReactElement] = React.useState(
    (children instanceof Array
      ? [...children]
      : [children]) as React.ReactElement[]
  );
  const [contentLinks, setContentLinks] = React.useState<
    IUsePageContentNavigationLink[]
  >([]);

  // [Setup] Scroll listener
  React.useEffect(() => {
    if (!enabled) return;

    // ↳ Event callback.
    function handleScroll(e: Event) {
      e.preventDefault();

      // Scrollbar is at the top, select the first section.
      if (window.scrollY === 0) setCurrentIndex(0);
      // Scrollbar is at the bottom, select the last section.
      else if (
        window.scrollY + window.innerHeight ===
        document.body.scrollHeight
      )
        setCurrentIndex(contentLinks.length - 1);
      // Scrollbar is at neither extreme.
      else if (contentLinks.length) {
        const scrollDirection =
          window.scrollY < previousScrollTop ? 'up' : 'down';

        // Guard to prevent a runtime error resulting from the `currentIndex`
        // being set to an extreme. This can happen when the setter is called
        // from outside the hook.
        if (
          (scrollDirection === 'up' && currentIndex > 0) ||
          (scrollDirection === 'down' && currentIndex < contentLinks.length - 1)
        ) {
          // Look at either the next or previous section.
          const selectedRect = document.getElementById(
            contentLinks[currentIndex + (scrollDirection === 'up' ? -1 : 1)]
              .scrollTo
          ) as HTMLElement;
          // User is scrolling down.
          if (
            scrollDirection === 'down' &&
            selectedRect.offsetTop - window.scrollY - contentTopOffset <=
              window.innerHeight * viewportBoundary - contentTopOffset
          )
            setCurrentIndex(currentIndex + 1);
          // User is scrolling up.
          else if (
            scrollDirection === 'up' &&
            selectedRect.getBoundingClientRect().bottom >=
              window.innerHeight * (1 - viewportBoundary)
          )
            setCurrentIndex(currentIndex - 1);
        }
      }

      setPreviousScrollTop(window.scrollY);
    }

    // ↳ Listen to scroll events.
    window.addEventListener('scroll', handleScroll);

    // ↳ Unregister the listener on component unmount.
    return () => window.removeEventListener('scroll', handleScroll);
  }, [
    contentLinks,
    currentIndex,
    previousScrollTop,
    viewportBoundary,
    enabled,
  ]);

  // [Setup] Content links & children mutation.
  React.useEffect(() => {
    if (!enabled) return;

    // Validate the children as we cannot allow any outlier or the hook won't
    // behave properly due to the nature of its at-extreme logic.
    childrenAsReactElement.forEach((child, index) => {
      // If the nested flag is set, dive into the child's props;
      // otherwise, check for the prop directly.
      const element = nestedSectionProp
        ? child.props[nestedSectionProp]
        : child;
      if (!element || typeof element.props[sectionTitleProp] !== 'string')
        throw new Error(
          `[usePageContentNavigation] Element at [${index}] does not have the '${sectionTitleProp}' prop.`
        );
    });
    // Map the filtered elements to recognisable links.
    const contentLinks =
      childrenAsReactElement.map<IUsePageContentNavigationLink>(
        ({ props }) => ({
          label: props[sectionTitleProp],
          scrollTo:
            props.id ||
            props[sectionTitleProp].toLowerCase().replaceAll(' ', '-') +
              '-section',
        })
      );
    setContentLinks(contentLinks);

    // Set the mutated children.
    setChildrenAsReactElement(
      childrenAsReactElement.map((child, index) => {
        if (!child.props.id) {
          const id = contentLinks[index].scrollTo;
          return React.cloneElement(child, {
            key: id,
            id,
          });
        }
        return child;
      })
    );
  }, [children, enabled]);

  return {
    currentIndex,
    contentLinks,
    setCurrentIndex,
    mutatedChildren: childrenAsReactElement,
  };
}

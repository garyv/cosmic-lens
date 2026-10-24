import { useRef } from 'react';
import { useDraggablePanel } from '../hooks/use-draggable-panel.ts';
import classNames from './description.module.css';

// the page's other controls, which the panel keeps clear of
const controls = 'header, nav, [role="toolbar"]';

/** a panel of text that drags by its edge to anywhere clear of the other controls */
export const Description = ({
  text,
  visible,
  className = '',
  ...rest
}: DescriptionProps) => {
  const panelRef = useRef<HTMLElement>(null);
  useDraggablePanel(panelRef, controls);

  return (
    <article
      {...rest}
      ref={panelRef}
      className={`${classNames.description} ${visible ? classNames.visible : ''} ${className}`}
    >
      {/* focusable, so after a click into the text the arrow keys scroll it */}
      <div
        className={classNames.content}
        tabIndex={0}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    </article>
  );
};

type DescriptionProps = {
  text: string;
  visible: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

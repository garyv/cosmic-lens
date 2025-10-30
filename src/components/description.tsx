import { useEffect, useRef } from 'react';
import classNames from './description.module.css';

export const Description = ({
  text,
  visible,
  className,
  ...rest
}: DescriptionProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      if (!ref.current) return;
      ref.current?.focus();
    }, 50);
  }, [visible]);

  return (
    <article
      tabIndex={visible ? 0 : -1}
      {...rest}
      ref={ref}
      className={`${classNames.description} ${visible ? classNames.visible : ''} ${className}`}
      dangerouslySetInnerHTML={{ __html: text }}
    ></article>
  );
};

type DescriptionProps = {
  text: string;
  visible: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

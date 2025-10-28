import classNames from './description.module.css';

export const Description = ({
  text,
  visible,
  className,
  ...rest
}: DescriptionProps) => (
  <article
    {...rest}
    className={`${classNames.description} ${visible ? classNames.visible : ''} ${className}`}
    dangerouslySetInnerHTML={{ __html: text }}
  ></article>
);

type DescriptionProps = {
  text: string;
  visible: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

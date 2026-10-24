import styles from './toolbar.module.css';

type ZoomToolbarProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;

  /** places the toolbar on the page */
  className?: string;
};

/** zoom in and out buttons, for any viewer that can zoom */
export const ZoomToolbar = ({
  onZoomIn,
  onZoomOut,
  className = '',
}: ZoomToolbarProps) => (
  <div
    className={`${styles.toolbar} ${className}`}
    role='toolbar'
    aria-label='Image controls'
  >
    <button
      className={styles.button}
      onClick={onZoomIn}
      title='Zoom in'
      type='button'
    >
      ＋
    </button>
    <button
      className={styles.button}
      onClick={onZoomOut}
      title='Zoom out'
      type='button'
    >
      −
    </button>
  </div>
);

type InfoToolbarProps = {
  onClick: () => void;

  /** whether the description it toggles is showing */
  isOpen: boolean;

  /** places the toolbar on the page */
  className?: string;
};

/** a button that shows and hides a description */
export const InfoToolbar = ({
  onClick,
  isOpen,
  className = '',
}: InfoToolbarProps) => (
  <div className={`${styles.toolbar} ${className}`} role='toolbar'>
    <button
      className={styles.button}
      title='More Info'
      type='button'
      aria-expanded={isOpen}
      onClick={onClick}
    >
      <i className={styles.info}>i</i>
    </button>
  </div>
);

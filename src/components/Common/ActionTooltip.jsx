import React from 'react';

/**
 * ActionTooltip - Standardized hover & focus tooltip for action buttons across DASMOM+ Staff Side.
 * Matches the reference design in Patient Profiles:
 * - Floating bubble above button with soft, light background (#fff5f7)
 * - Subtle border and shadow with rounded corners
 * - Pointer arrow
 * - Displays on hover and focus-within (keyboard accessible)
 * - Automatically strips native `title` attribute on child to prevent browser-default tooltips
 * - Automatically ensures `aria-label` is present for accessibility on icon-only buttons
 */
const ActionTooltip = ({
  text,
  align = 'right', // 'right' (default, reference Patient Profiles design), 'center', or 'left'
  position = 'top', // 'top' (default) or 'bottom'
  className = '',
  children,
  ...props
}) => {
  if (!text) return children;

  const alignClass = align === 'center' ? 'tooltip-center' : align === 'left' ? 'tooltip-left' : '';
  const posClass = position === 'bottom' ? 'tooltip-bottom' : '';

  // Ensure title is removed from child to prevent duplicate browser tooltips,
  // and inject aria-label if missing for accessibility
  let childContent = children;
  if (React.isValidElement(children)) {
    const childProps = children.props || {};
    const newProps = {};
    if (!childProps['aria-label'] && !childProps['aria-labelledby']) {
      newProps['aria-label'] = text;
    }
    if (childProps.title !== undefined) {
      newProps.title = undefined;
    }
    if (Object.keys(newProps).length > 0) {
      childContent = React.cloneElement(children, newProps);
    }
  }

  return (
    <div
      className={`action-tooltip-wrap ${alignClass} ${posClass} ${className}`.trim()}
      data-tooltip={text}
      data-align={align}
      data-position={position}
      {...props}
    >
      {childContent}
    </div>
  );
};

export default ActionTooltip;

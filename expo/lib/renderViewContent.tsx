import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

function renderNode(child: React.ReactNode, textStyle?: StyleProp<TextStyle>, keyPrefix = 'view-safe'): React.ReactNode {
  if (child === null || child === undefined || typeof child === 'boolean') {
    return null;
  }

  if (typeof child === 'string' || typeof child === 'number') {
    return (
      <Text key={keyPrefix} style={textStyle}>
        {child}
      </Text>
    );
  }

  if (Array.isArray(child)) {
    return child.map((nestedChild, index) => renderNode(nestedChild, textStyle, `${keyPrefix}-${index}`));
  }

  if (React.isValidElement(child) && child.type === React.Fragment) {
    const fragmentChildren = (child.props as { children?: React.ReactNode }).children;
    return (
      <React.Fragment key={child.key ?? keyPrefix}>
        {renderViewContent(fragmentChildren, textStyle, keyPrefix)}
      </React.Fragment>
    );
  }

  return child;
}

export function renderViewContent(
  children: React.ReactNode,
  textStyle?: StyleProp<TextStyle>,
  keyPrefix = 'view-safe'
): React.ReactNode {
  return React.Children.toArray(children).map((child, index) => renderNode(child, textStyle, `${keyPrefix}-${index}`));
}

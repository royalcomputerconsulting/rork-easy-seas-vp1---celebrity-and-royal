import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

type PrimitiveRenderable = string | number | bigint;

function isPrimitiveRenderable(value: unknown): value is PrimitiveRenderable {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint';
}

function normalizeNode(
  node: React.ReactNode,
  textStyle?: StyleProp<TextStyle>,
  keyPrefix = 'node'
): React.ReactNode {
  return React.Children.map(node, (child, index) => {
    const childKey = `${keyPrefix}-${index}`;

    if (child === null || child === undefined || typeof child === 'boolean') {
      return null;
    }

    if (isPrimitiveRenderable(child)) {
      return (
        <Text key={childKey} style={textStyle}>
          {String(child)}
        </Text>
      );
    }

    if (React.isValidElement(child)) {
      if (child.type === React.Fragment) {
        const fragmentChild = child as React.ReactElement<{ children?: React.ReactNode }>;

        return (
          <React.Fragment key={child.key ?? childKey}>
            {normalizeNode(fragmentChild.props.children, textStyle, childKey)}
          </React.Fragment>
        );
      }

      return child;
    }

    return null;
  });
}

export function renderNodeInView(
  node: React.ReactNode,
  textStyle?: StyleProp<TextStyle>
): React.ReactNode {
  return normalizeNode(node, textStyle);
}

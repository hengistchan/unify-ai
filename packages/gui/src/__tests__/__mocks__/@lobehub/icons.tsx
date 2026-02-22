import React from 'react';
import { vi } from 'vitest';

const createMockIcon = (testId: string) => {
  const MockIcon = ({ size = 32, className }: { size?: number; className?: string }) => (
    <svg data-testid={testId} width={size} height={size} className={className} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
    </svg>
  );
  MockIcon.displayName = `Mock${testId}`;
  return MockIcon;
};

export const Cursor = createMockIcon('cursor-icon');
export const Cline = createMockIcon('cline-icon');
export const Windsurf = createMockIcon('windsurf-icon');

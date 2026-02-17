/**
 * Button Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/common/Button';
import { Plus } from 'lucide-react';

describe('Button', () => {
  describe('Rendering', () => {
    it('should render with children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('should render without children', () => {
      render(<Button aria-label="icon button"><Plus /></Button>);
      expect(screen.getByRole('button', { name: /icon button/i })).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('should render primary variant by default', () => {
      render(<Button>Primary</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-primary');
    });

    it('should render secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-transparent');
    });

    it('should render ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-transparent');
      expect(button.className).toContain('text-text-secondary');
    });

    it('should render danger variant', () => {
      render(<Button variant="danger">Danger</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-error');
    });
  });

  describe('Sizes', () => {
    it('should render md size by default', () => {
      render(<Button>Medium</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('px-4 py-2');
    });

    it('should render sm size', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('px-3 py-1.5');
    });

    it('should render lg size', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('px-6 py-3');
    });
  });

  describe('Full Width', () => {
    it('should not be full width by default', () => {
      render(<Button>Normal Width</Button>);
      const button = screen.getByRole('button');
      expect(button.className).not.toContain('w-full');
    });

    it('should be full width when prop is true', () => {
      render(<Button fullWidth>Full Width</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('w-full');
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when loading', () => {
      render(<Button loading>Loading</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      // Loader2 icon has animate-spin class
      expect(button.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('should be disabled when loading', () => {
      render(<Button loading>Loading</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should not show children when loading', () => {
      render(<Button loading>Loading Text</Button>);
      expect(screen.queryByText('Loading Text')).not.toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should have disabled styling', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('disabled:opacity-50');
    });
  });

  describe('Icons', () => {
    it('should render icon on left by default', () => {
      render(<Button icon={<Plus data-testid="plus-icon" />}>With Icon</Button>);
      const button = screen.getByRole('button');
      const icon = screen.getByTestId('plus-icon');
      expect(button).toContainElement(icon);
    });

    it('should render icon on right when specified', () => {
      render(
        <Button icon={<Plus data-testid="plus-icon" />} iconPosition="right">
          With Right Icon
        </Button>
      );
      const button = screen.getByRole('button');
      const text = screen.getByText('With Right Icon');
      const icon = screen.getByTestId('plus-icon');
      // Icon should come after text in DOM
      // Node.DOCUMENT_POSITION_FOLLOWING = 4
      const position = text.compareDocumentPosition(icon);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
  });

  describe('Click Handler', () => {
    it('should call onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} disabled>Click me</Button>);

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should not call onClick when loading', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} loading>Click me</Button>);

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Custom Props', () => {
    it('should spread additional props to button element', () => {
      render(<Button data-testid="custom-button" type="submit">Submit</Button>);
      const button = screen.getByTestId('custom-button');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('should apply custom className', () => {
      render(<Button className="custom-class">Custom</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('custom-class');
    });
  });

  describe('Ref Forwarding', () => {
    it('should forward ref to button element', () => {
      const ref = { current: null as HTMLButtonElement | null };
      render(<Button ref={ref}>Ref Test</Button>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe('Accessibility', () => {
    it('should have focus styles', () => {
      render(<Button>Focusable</Button>);
      const button = screen.getByRole('button');
      expect(button.className).toContain('focus:outline-none');
      expect(button.className).toContain('focus:ring-2');
    });
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { OtpInput } from '../../components/ui/OtpInput';

describe('OtpInput Component', () => {
  const TestWrapper = ({ onComplete }: { onComplete?: (val: string) => void }) => {
    const [val, setVal] = useState('');
    return <OtpInput value={val} onChange={setVal} onComplete={onComplete} />;
  };

  it('renders 6 numeric input boxes', () => {
    render(<TestWrapper />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(6);
  });

  it('allows single digit typing and triggers onComplete when 6th digit entered', () => {
    const onComplete = vi.fn();
    render(<TestWrapper onComplete={onComplete} />);
    const inputs = screen.getAllByRole('textbox');

    fireEvent.keyDown(inputs[0], { key: '1' });
    fireEvent.keyDown(inputs[1], { key: '2' });
    fireEvent.keyDown(inputs[2], { key: '3' });
    fireEvent.keyDown(inputs[3], { key: '4' });
    fireEvent.keyDown(inputs[4], { key: '5' });
    fireEvent.keyDown(inputs[5], { key: '6' });

    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('handles paste event across all 6 inputs', () => {
    const onComplete = vi.fn();
    render(<TestWrapper onComplete={onComplete} />);
    const inputs = screen.getAllByRole('textbox');

    fireEvent.paste(inputs[0], {
      clipboardData: {
        getData: () => '987-654',
      },
    });

    expect(onComplete).toHaveBeenCalledWith('987654');
  });

  it('handles backspace to delete digits', () => {
    const Wrapper = () => {
      const [val, setVal] = useState('12');
      return <OtpInput value={val} onChange={setVal} />;
    };
    render(<Wrapper />);
    const inputs = screen.getAllByRole('textbox');

    fireEvent.keyDown(inputs[1], { key: 'Backspace' });
    // Should clear second digit
  });
});


import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ToastProvider } from '../../context/ToastContext';
import { useToast } from '../../context/useToast';

function TestComponent() {
  const toast = useToast();

  return (
    <div>
      <button
        onClick={() =>
          toast.info('Video stream re-authenticated. Resuming playback...', 'Stream Renewed')
        }
      >
        Trigger Info Toast
      </button>
      <button onClick={() => toast.success('Operation succeeded', 'Success Title')}>
        Trigger Success Toast
      </button>
      <button onClick={() => toast.error('An error occurred', 'Error Title')}>
        Trigger Error Toast
      </button>
      <button onClick={() => toast.warning('A warning occurred', 'Warning Title')}>
        Trigger Warning Toast
      </button>
    </div>
  );
}

describe('ToastProvider & Dark Mode Visibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders info toast with high-contrast dark mode classes for title, message, and background', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const infoBtn = screen.getByText('Trigger Info Toast');
    act(() => {
      fireEvent.click(infoBtn);
    });

    // Check title and message are in the DOM
    const titleEl = screen.getByText('Stream Renewed');
    const msgEl = screen.getByText('Video stream re-authenticated. Resuming playback...');

    expect(titleEl).toBeInTheDocument();
    expect(msgEl).toBeInTheDocument();

    // Verify dark mode contrast classes are present on title and message
    expect(titleEl).toHaveClass('dark:text-white');
    expect(msgEl).toHaveClass('dark:text-slate-300');

    // Verify toast container has dark mode background and border
    const toastCard = titleEl.closest('[role="status"]');
    expect(toastCard).toBeInTheDocument();
    expect(toastCard).toHaveClass('dark:bg-slate-900/95', 'dark:border-blue-500/40');
  });

  it('allows dismissing the toast manually', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => {
      fireEvent.click(screen.getByText('Trigger Info Toast'));
    });

    expect(screen.getByText('Stream Renewed')).toBeInTheDocument();

    const dismissBtn = screen.getByRole('button', { name: /Dismiss toast/i });
    act(() => {
      fireEvent.click(dismissBtn);
    });

    expect(screen.queryByText('Stream Renewed')).not.toBeInTheDocument();
  });
});

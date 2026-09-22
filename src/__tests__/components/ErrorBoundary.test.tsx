import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { errorTracker } from '../../lib/observability/errorTracking';

function FaultyComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Explosive test failure');
  }
  return <div>Component rendered successfully</div>;
}

describe('ErrorBoundary Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    errorTracker.clearErrorBuffer();
    // Suppress console.error during deliberate error throwing in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children normally when no exception is thrown', () => {
    render(
      <ErrorBoundary>
        <FaultyComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Component rendered successfully')).toBeInTheDocument();
  });

  it('catches render error, reports to errorTracker, and displays recovery UI', () => {
    const captureSpy = vi.spyOn(errorTracker, 'captureException');

    render(
      <ErrorBoundary>
        <FaultyComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Application Encountered a Problem')).toBeInTheDocument();
    expect(screen.getByText(/An unexpected user interface exception was caught/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload Application/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Return to Home/i })).toBeInTheDocument();

    expect(captureSpy).toHaveBeenCalled();
  });

  it('toggles diagnostic stack trace accordion when clicked', () => {
    render(
      <ErrorBoundary>
        <FaultyComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    const toggleButton = screen.getByRole('button', { name: /Diagnostic Stack Details/i });
    expect(screen.queryByText(/Explosive test failure/)).not.toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.getByText(/Explosive test failure/)).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.queryByText(/Explosive test failure/)).not.toBeInTheDocument();
  });

  it('renders custom fallback element when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom Error Fallback</div>}>
        <FaultyComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Error Fallback')).toBeInTheDocument();
    expect(screen.queryByText('Application Encountered a Problem')).not.toBeInTheDocument();
  });
});


"use client";

import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
          <h1 className="text-2xl font-bold text-red-600">
            Something went wrong
          </h1>
          <p className="text-gray-600">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            Try again
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

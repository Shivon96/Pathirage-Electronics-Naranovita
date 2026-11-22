import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'Unexpected error occurred' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-slate-900">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-[10px] p-6 shadow-sm">
            <div className="flex items-center gap-3 text-red-700 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-bold">Application Recovery</h1>
            </div>
            <p className="text-sm text-slate-600 mb-4 break-words">{this.state.errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[48px] px-4 py-2.5 bg-blue-700 text-white font-semibold rounded-[10px] flex items-center justify-center gap-2 hover:bg-blue-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Store
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

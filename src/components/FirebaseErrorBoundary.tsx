import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  error: Error | null;
}

export class FirebaseErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      let friendly = 'An unexpected error occurred while syncing account data.';
      const msg = this.state.error.message || '';
      if (msg.includes('Quota exceeded')) {
        friendly =
          'Daily Firestore free-tier quota has been exceeded. Quota resets tomorrow.';
      } else if (msg.includes('Missing or insufficient permissions')) {
        friendly =
          'Account permission verification failed. Please sign out and sign in again.';
      }

      return (
        <div className="min-h-screen bg-[#070B14] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-red-500/35 bg-[#0F1624] p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto">
              <AlertTriangle size={22} className="text-red-400" />
            </div>
            <h2 className="font-display text-xl font-semibold text-white">
              Connection Interrupted
            </h2>
            <p className="text-sm text-slate-300">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#070B14] font-semibold py-2.5 px-4 text-sm cursor-pointer"
            >
              <RotateCcw size={15} />
              <span>Reload Game</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

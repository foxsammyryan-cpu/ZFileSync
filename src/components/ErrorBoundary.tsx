import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  label?: string;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[ErrorBoundary]", this.props.label ?? "", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3">
          <p className="text-sm font-semibold text-danger">
            {this.props.label ? `${this.props.label} crashed` : "Something broke"}
          </p>
          <pre className="text-xs font-mono text-muted max-w-xl whitespace-pre-wrap break-words">
            {this.state.error.message}
          </pre>
          <button
            onClick={this.reset}
            className="text-xs px-3 py-1.5 rounded-md bg-surface-2 hover:bg-surface text-text transition-colors cursor-pointer"
          >
            Reload panel
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

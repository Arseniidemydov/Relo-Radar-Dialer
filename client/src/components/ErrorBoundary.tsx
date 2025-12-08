import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-screen w-full items-center justify-center bg-gray-100 p-4">
                    <div className="rounded-lg bg-white p-8 shadow-xl">
                        <h1 className="mb-4 text-2xl font-bold text-red-600">Something went wrong.</h1>
                        <p className="text-gray-600">Please refresh the page later.</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-6 rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

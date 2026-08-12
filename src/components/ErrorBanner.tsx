type ErrorBannerProps = {
  message: string;
  onDismiss: () => void;
};

const ErrorBanner = ({ message, onDismiss }: ErrorBannerProps) => (
  <div className="w-full max-w-3xl flex items-center justify-between gap-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-2 text-sm">
    <span>{message}</span>
    <button onClick={onDismiss} className="font-medium hover:text-rose-900">
      Dismiss
    </button>
  </div>
);

export default ErrorBanner;

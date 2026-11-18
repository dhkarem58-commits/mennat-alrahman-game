import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'حدث خطأ غير متوقع في عرض التطبيق.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="flex h-screen w-screen items-center justify-center bg-[#EEF2F6] p-6 text-[#171C19]"
        >
          <div className="max-w-md rounded-xl border border-[#171C19]/15 bg-[#FBF9F4] p-6 text-right shadow-md">
            <h1 className="font-scholar text-2xl font-bold text-[#B9382C]">
              تنبيه في تشغيل الأكاديمية
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#171C19]/80">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-[#1E6B47] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#175538]"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

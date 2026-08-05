import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Status } from './Status';
import { DEFAULT_LANG, asLang, translate } from '../lib/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Last line of defence. Without this a render-time throw leaves the webview
 * showing nothing but the page background, which reads as a dead app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[app] render failed:', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    // The language setting lives on the server, which we may have never
    // reached — fall back to the Telegram UI language, then to Russian.
    const hint = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    const lang = hint === 'en' ? asLang('en') : DEFAULT_LANG;

    return (
      <Status
        icon="info"
        title={translate(lang, 'crashTitle')}
        body={translate(lang, 'crashBody')}
        primary={{ label: translate(lang, 'reload'), onClick: () => window.location.reload() }}
      />
    );
  }
}

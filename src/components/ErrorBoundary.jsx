import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    try {
      console.error('[ErrorBoundary] caught:', error, info);
    } catch {
      // ignore
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary" role="alert">
          <h1>页面出错了</h1>
          <p>渲染过程发生意外，页面已中断。请刷新后重试，你的文件不会丢失。</p>
          <button type="button" onClick={() => window.location.reload()}>刷新页面</button>
        </div>
      );
    }
    return this.props.children;
  }
}

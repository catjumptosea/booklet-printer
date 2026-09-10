import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          fontSize: 14,
          fontSizeSM: 12,
          fontSizeLG: 16,
          lineHeight: 22 / 14,
          lineHeightLG: 24 / 16,
          fontWeightStrong: 600,
          colorText: 'rgba(0, 0, 0, 0.88)',
          colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
          colorTextDisabled: 'rgba(0, 0, 0, 0.25)',
          colorBorder: '#d9d9d9',
          colorBgLayout: '#f5f5f5',
          colorFillAlter: '#fafafa',
          colorPrimary: '#0e7a6d',
          colorPrimaryHover: '#0a5f55',
          colorPrimaryActive: '#0a5f55',
          colorPrimaryBg: '#e2f2ef',
          colorPrimaryBgHover: '#d5ece7',
          paddingXS: 8,
          paddingSM: 12,
          padding: 16,
          paddingLG: 24,
          marginXS: 8,
          marginSM: 12,
          margin: 16,
          marginLG: 24,
        },
      }}
    >
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ConfigProvider>
  </React.StrictMode>,
);

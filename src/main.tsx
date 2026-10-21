import {FeedbackProvider} from './components/Feedback';
import './services/pwa';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/theme.css';
import './styles/simple.css';
import './styles/dark.css';
import './styles/party.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FeedbackProvider><App /></FeedbackProvider>
  </React.StrictMode>
);
import './styles/pro.css';

import './styles/feedback.css';

import './styles/brand-navigation.css';

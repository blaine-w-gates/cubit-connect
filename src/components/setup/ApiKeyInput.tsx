'use client';

import { useState, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAppStore } from '@/store/useAppStore';

export function ApiKeyInput() {
  const [key, setKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPrivateBrowsing = useAppStore((state) => state.isPrivateBrowsing);
  const setApiKey = useAppStore((state) => state.setApiKey);
  
  // Prevent double-execution
  const isValidatingRef = useRef(false);

  const handleConnect = async () => {
    // Guard against double-clicks
    if (isValidatingRef.current) return;
    
    setError(null);
    const trimmedKey = key.trim();

    // Basic format validation
    if (!trimmedKey) {
      setError('Please enter an API key');
      return;
    }

    if (!trimmedKey.startsWith('AI')) {
      setError('Invalid API key format. Gemini keys start with "AI"');
      return;
    }

    // Test the key with Gemini
    isValidatingRef.current = true;
    setIsValidating(true);

    try {
      const genAI = new GoogleGenerativeAI(trimmedKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      
      // Test call using generateContent (more reliable than countTokens)
      await model.generateContent('Test');
      
      // Success - save the key
      await setApiKey(trimmedKey);
    } catch (err) {
      console.error('[ApiKeyInput] Validation failed:', err);
      
      // Provide user-friendly error message
      if (err instanceof Error) {
        if (err.message.includes('API_KEY_INVALID')) {
          setError('Invalid API key. Please check and try again.');
        } else if (err.message.includes('PERMISSION_DENIED')) {
          setError('API key does not have permission. Enable the Generative AI API.');
        } else if (err.message.includes('QUOTA_EXCEEDED')) {
          setError('API quota exceeded. Try again later or use a different key.');
        } else {
          setError('Could not validate API key. Please try again.');
        }
      } else {
        setError('Could not validate API key. Please try again.');
      }
    } finally {
      setIsValidating(false);
      isValidatingRef.current = false;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isValidating) {
      handleConnect();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Cubit Connect
            </h1>
            <p className="text-gray-600 text-sm">
              Enter your Google Gemini API key to get started
            </p>
          </div>

          {/* Private Browsing Warning */}
          {isPrivateBrowsing && (
            <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                ⚠️ Private browsing detected. Your data will not persist after closing this tab.
              </p>
            </div>
          )}

          {/* Input Field */}
          <div className="mb-4">
            <label 
              htmlFor="api-key" 
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              API Key
            </label>
            <input
              id="api-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="AIza..."
              disabled={isValidating}
              className={`
                w-full px-4 py-3 border rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:bg-gray-100 disabled:cursor-not-allowed
                ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'}
              `}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Connect Button */}
          <button
            onClick={handleConnect}
            disabled={isValidating || !key.trim()}
            className={`
              w-full py-3 px-4 rounded-lg font-medium text-white
              transition-colors duration-200
              ${isValidating || !key.trim()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
              }
            `}
          >
            {isValidating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Validating...
              </span>
            ) : (
              'Connect'
            )}
          </button>

          {/* Help Text */}
          <p className="mt-6 text-center text-xs text-gray-500">
            Get your API key from{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Google AI Studio
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

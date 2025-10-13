import React, { useState, useEffect } from 'react';

const ChatBubble = ({ message, isAI }) => {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    let timeoutId;
    if (isCopied) {
      timeoutId = setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    }
    return () => clearTimeout(timeoutId);
  }, [isCopied]);

  
 const handleCopy = () => {
    if (isAI) {
      navigator.clipboard.writeText(message)
        .then(() => {
          setIsCopied(true);
        })
        .catch(err => {
          console.error('Failed to copy message: ', err);
        });
    }
  };

  return (
    <div>
      <div className="pb-4" style={{ opacity: 1 }}>
      <div 
          className={`group relative pt-3.5 pb-4 px-4 rounded-2xl -tracking-[0.015em] ${
            isAI ? 'bg-gray-700 text-gray-300' : 'bg-gray-900 text-gray-300'
          }`}
        >
          <div className="pr-4 md:pr-9 relative leading-[1.65rem] [&_pre>div]:bg-bg-300 [&_pre]:-mr-4 md:[&_pre]:-mr-9">
            <div>
              <div className="grid-col-1 grid gap-2.5 [&_>_*]:min-w-0">
                <p className="whitespace-pre-wrap break-words">
                  <strong>{isAI ? 'AI:' : 'You:'}</strong> {message}
                </p>
              </div>
            </div>
          </div>
          {isAI && (
            <div className="absolute bottom-1 right-1.5" style={{ transform: 'none' }}>
              <div className="border-0.5 border-border-300 flex items-center translate-y-1/2 rounded-lg shadow-sm transition scale-95 opacity-0 group-hover:scale-100 group-hover:opacity-100 p-1">
                <div className="text-text-400 z-40 p-2 bg-gray-900 rounded-full flex items-stretch justify-between gap-0.5">
                  <div className="flex gap-0.5">
                  <button 
                      className="flex flex-row items-center gap-1 rounded-md p-1 py-0.5 text-xs transition-opacity delay-100 hover:bg-bg-200"
                      onClick={handleCopy}
                    >
                      {isCopied ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 256 256">
                          <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"></path>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 256 256">
                          <path d="M200,32H163.74a47.92,47.92,0,0,0-71.48,0H56A16,16,0,0,0,40,48V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm-72,0a32,32,0,0,1,32,32H96A32,32,0,0,1,128,32Zm72,184H56V48H82.75A47.93,47.93,0,0,0,80,64v8a8,8,0,0,0,8,8h80a8,8,0,0,0,8-8V64a47.93,47.93,0,0,0-2.75-16H200Z"></path>
                        </svg>
                      )}
                      {isCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;

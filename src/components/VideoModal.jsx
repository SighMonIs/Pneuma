import { X, ExternalLink } from 'lucide-react';

export default function VideoModal({ video, showComments, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-4xl bg-[#1a1a1a] rounded-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
          <h3 className="text-white text-sm font-medium truncate flex-1">{video.title}</h3>
          <a
            href={`https://www.youtube.com/watch?v=${video.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-800 transition-colors flex-shrink-0"
            title="Open in YouTube"
          >
            <ExternalLink size={15} />
          </a>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* Player */}
        <div className="aspect-video w-full">
          <iframe
            src={`https://www.youtube.com/embed/${video.id}?autoplay=1`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            title={video.title}
          />
        </div>

        {/* Comments footer — shown when showComments is on */}
        {showComments && (
          <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between gap-3">
            <p className="text-gray-500 text-sm">Comments aren't available in the embedded player.</p>
            <a
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex-shrink-0 transition-colors"
            >
              <ExternalLink size={13} />
              View on YouTube
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

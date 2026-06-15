import { Tv2, Youtube } from 'lucide-react';

export default function AuthPage() {
  const handleConnect = () => {
    window.location.href = '/api/auth/login';
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <div className="flex flex-col items-center gap-8 text-center max-w-md px-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
            <Tv2 size={24} className="text-white" />
          </div>
          <span className="text-3xl font-bold text-white tracking-tight">Pneuma</span>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-3">
          <p className="text-gray-300 text-lg leading-relaxed">
            Your personal YouTube subscription organizer.
          </p>
          <p className="text-gray-500 text-sm leading-relaxed">
            Connect your YouTube account to sync subscriptions, organize channels into categories, and discover videos.
          </p>
        </div>

        {/* Features list */}
        <ul className="text-left text-gray-400 text-sm space-y-2 w-full bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
          {[
            'Sync all your YouTube subscriptions',
            'Organize channels into custom categories',
            'Browse videos from all subscriptions',
            'Filter out Shorts and watched videos',
            'Schedule automatic syncs',
          ].map((feature, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">•</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {/* Connect button */}
        <button
          onClick={handleConnect}
          className="flex items-center gap-3 bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-lg font-semibold text-base transition-colors duration-150 w-full justify-center"
        >
          <Youtube size={20} />
          Connect YouTube
        </button>

        <p className="text-gray-600 text-xs">
          This app only requests read-only access to your YouTube subscriptions.
        </p>
      </div>
    </div>
  );
}

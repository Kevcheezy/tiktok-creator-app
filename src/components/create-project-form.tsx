'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Character {
  id: string;
  name: string;
  avatarPersona: string | null;
}

export function CreateProjectForm() {
  const router = useRouter();
  const [productUrl, setProductUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch characters for dropdown
    fetch('/api/characters')
      .then((res) => res.ok ? res.json() : [])
      .then(setCharacters)
      .catch(() => setCharacters([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productUrl,
          videoUrl: videoUrl || undefined,
          characterId: characterId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create project');
      }

      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="productUrl" className="block text-sm font-medium text-gray-700">
          Product URL <span className="text-red-500">*</span>
        </label>
        <input
          type="url"
          id="productUrl"
          required
          value={productUrl}
          onChange={(e) => setProductUrl(e.target.value)}
          placeholder="https://www.tiktok.com/shop/pdp/..."
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="videoUrl" className="block text-sm font-medium text-gray-700">
          Reference Video URL <span className="text-gray-400">(optional)</span>
        </label>
        <input
          type="url"
          id="videoUrl"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.tiktok.com/@user/video/..."
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="character" className="block text-sm font-medium text-gray-700">
          Character <span className="text-gray-400">(optional)</span>
        </label>
        <select
          id="character"
          value={characterId}
          onChange={(e) => setCharacterId(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Auto-detect from product category</option>
          {characters.map((char) => (
            <option key={char.id} value={char.id}>
              {char.name} ({char.avatarPersona})
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Creating...' : 'Create Project'}
      </button>
    </form>
  );
}

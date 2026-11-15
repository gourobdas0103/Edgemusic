export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // Helper for JSON responses with CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API Routes
    if (pathname.startsWith('/api/')) {
      // 1. GET /api/tracks -> Fetch all tracks (READ)
      if (pathname === '/api/tracks' && method === 'GET') {
        try {
          const { results } = await env.DB.prepare(
            'SELECT * FROM tracks ORDER BY id DESC'
          ).all();
          return new Response(JSON.stringify(results || []), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // 2. POST /api/tracks -> Upload audio to R2 & insert metadata to D1 (CREATE)
      if (pathname === '/api/tracks' && method === 'POST') {
        try {
          const formData = await request.formData();
          const title = formData.get('title') || 'Untitled Track';
          const artist = formData.get('artist') || 'Unknown Artist';
          const genre = formData.get('genre') || 'Podcast';
          const duration = formData.get('duration') || '0:00';
          const audioFile = formData.get('file');

          if (!audioFile) {
            return new Response(JSON.stringify({ error: 'Audio file is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }

          // Generate clean unique key for R2 storage
          const sanitizedFilename = (audioFile.name || 'track.mp3').replace(/[^a-zA-Z0-9._-]/g, '_');
          const fileKey = `${Date.now()}-${sanitizedFilename}`;

          // Save binary audio to Cloudflare R2 bucket
          await env.MUSIC_BUCKET.put(fileKey, audioFile.stream(), {
            httpMetadata: {
              contentType: audioFile.type || 'audio/mpeg',
            },
          });

          // Insert metadata row into Cloudflare D1
          const result = await env.DB.prepare(
            'INSERT INTO tracks (title, artist, genre, duration, r2_key) VALUES (?, ?, ?, ?, ?)'
          )
            .bind(title, artist, genre, duration, fileKey)
            .run();

          return new Response(
            JSON.stringify({
              success: true,
              id: result.meta ? result.meta.last_row_id : null,
              r2_key: fileKey,
            }),
            {
              status: 201,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // 3. GET /api/stream/:key -> Stream audio from R2 (STREAM / READ)
      if (pathname.startsWith('/api/stream/') && method === 'GET') {
        try {
          const key = decodeURIComponent(pathname.replace('/api/stream/', ''));
          const rangeHeader = request.headers.get('Range');

          const object = await env.MUSIC_BUCKET.get(key, {
            range: request.headers,
            onlyIf: request.headers,
          });

          if (!object) {
            return new Response('Audio file not found in R2 storage', { status: 404 });
          }

          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set('etag', object.httpEtag);
          headers.set('Accept-Ranges', 'bytes');
          headers.set('Content-Type', headers.get('Content-Type') || 'audio/mpeg');
          headers.set('Access-Control-Allow-Origin', '*');

          if (object.range) {
            headers.set(
              'Content-Range',
              `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`
            );
            return new Response(object.body, { headers, status: 206 });
          }

          return new Response(object.body, { headers, status: 200 });
        } catch (err) {
          return new Response(`Streaming error: ${err.message}`, { status: 500 });
        }
      }

      // 4. PUT /api/tracks/:id -> Update metadata in D1 (UPDATE)
      if (pathname.startsWith('/api/tracks/') && method === 'PUT') {
        try {
          const id = pathname.split('/').pop();
          const body = await request.json();
          const { title, artist, genre } = body;

          await env.DB.prepare(
            'UPDATE tracks SET title = ?, artist = ?, genre = ? WHERE id = ?'
          )
            .bind(title, artist, genre, id)
            .run();

          return new Response(JSON.stringify({ success: true, message: 'Track updated' }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // 5. DELETE /api/tracks/:id -> Delete from D1 & R2 (DELETE)
      if (pathname.startsWith('/api/tracks/') && method === 'DELETE') {
        try {
          const id = pathname.split('/').pop();

          // Query the track key to remove binary from R2
          const track = await env.DB.prepare('SELECT r2_key FROM tracks WHERE id = ?')
            .bind(id)
            .first();

          if (track && track.r2_key) {
            await env.MUSIC_BUCKET.delete(track.r2_key);
          }

          // Delete row from D1
          await env.DB.prepare('DELETE FROM tracks WHERE id = ?').bind(id).run();

          return new Response(JSON.stringify({ success: true, message: 'Track deleted' }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      return new Response(JSON.stringify({ error: 'Route not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Serve frontend static assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('EdgeMusic Worker Backend Active', { status: 200 });
  },
};

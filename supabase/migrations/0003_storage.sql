-- Storage for hero images on feed posts.
--
-- The bucket is public-read because post images are referenced directly from
-- the feed and are not sensitive: they are the same photographs the school
-- publishes on its website and in the newsletter. Writes go only through the
-- upload route, which runs as the service role after checking the session.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-images',
  'post-images',
  true,
  8388608,                                     -- 8 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Anyone may read an image by URL.
create policy "post images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'post-images');

-- Nobody writes directly from the browser. Uploads are mediated by
-- /api/uploads/hero, which authenticates first and then uses the service
-- role, so no insert policy is granted to authenticated users here.

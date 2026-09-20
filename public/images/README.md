# Photographs

Drop a file in and it appears on the site. No code change.

```
public/images/products/<product-slug>.jpg
public/images/meals/<meal-slug>.jpg
```

Until a file is there the request 404s, `onError` fires in `Artwork`, and the
drawn artwork underneath stays on screen — so photographs can arrive one at a
time instead of all at once.

## The slugs

Products:

```
croaker          red-snapper      titus            catfish          tilapia
tiger-prawns     brown-shrimps    blue-crab        panla            bonga
```

Meals:

```
seafood-okra     pepper-soup      seafood-pasta    seafood-boil
```

## What the photographs need to be

**Your own fish.** Not stock photography. The whole proposition is "caught
today or it is not listed", and a stock photo of someone else's salmon is the
one thing on this site that would be a lie. It is also the fastest way to get
a complaint you cannot answer: the customer opens the box and it does not look
like the picture.

Practically:

- **Landscape, about 4:3 or 3:2.** Cards crop to fill, so keep the fish
  centred and leave room at the edges.
- **1600px on the long side is plenty**, and keep each file under ~300 KB —
  these load on Lagos mobile data, on a page with ten of them.
- **Shoot on ice, from above, in daylight.** It is what the product actually
  looks like when it reaches the door, and it photographs better than anything
  staged.
- **One fish per photo**, so the customer can judge the size.

If a file needs to live somewhere else — a CDN, Supabase storage — set
`imageUrl` on the product instead and it wins over this convention.

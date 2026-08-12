# react-dnd-ui

![image](https://github.com/RameshNeupane/react-dnd-ui/assets/45593423/7586012c-5d7a-44d7-8914-99179c4c102d)

## Deployment
https://react-dnd-ui.vercel.app/

## Setup

1. `npm install`
2. Create a free project at https://supabase.com.
3. In the Supabase SQL editor, run the contents of `supabase/migrations/0001_init.sql`.
4. In Project Settings → API, copy the Project URL and the `anon` public key.
5. Copy `.env.local.example` to `.env.local` and fill in those two values.
6. `npm run dev`

## Testing

`npm test` runs the Vitest unit tests (currently: the card/column reorder helpers).

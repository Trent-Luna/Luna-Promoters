'use client'
import { useTransition } from 'react'
import { deletePost } from '../actions'
export function DeletePost({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <button disabled={pending} onClick={() => { if (confirm('Delete this post?')) start(() => deletePost(id)) }}
      className="btn-ghost !py-1.5 !px-3 text-xs !text-luna-muted hover:!text-red-400">Delete</button>
  )
}

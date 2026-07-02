'use client'
import { useTransition } from 'react'
import { deletePost } from '../actions'
export function DeletePost({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <button disabled={pending} onClick={() => { if (confirm('Delete this post?')) start(() => deletePost(id)) }}
      className="pill bg-luna-surface border border-luna-border text-luna-muted hover:text-red-400 px-3 py-1.5">Delete</button>
  )
}

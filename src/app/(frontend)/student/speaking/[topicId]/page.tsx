import { notFound } from 'next/navigation'
import { speakingTopics } from '../topics'
import SpeakingRoom from './SpeakingRoom'

type Props = {
  params: Promise<{ topicId: string }>
}

export async function generateStaticParams() {
  return speakingTopics.map((t) => ({ topicId: t.id }))
}

export async function generateMetadata({ params }: Props) {
  const { topicId } = await params
  const topic = speakingTopics.find((t) => t.id === topicId)
  return {
    title: topic ? `Speaking: ${topic.title}` : 'Speaking Practice',
  }
}

export default async function SpeakingTopicPage({ params }: Props) {
  const { topicId } = await params
  const topic = speakingTopics.find((t) => t.id === topicId)

  if (!topic) return notFound()

  return <SpeakingRoom topic={topic} />
}


import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPostBySlug, getPostsByTag } from '@/lib/blog'
import ReactMarkdown, { Components } from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import Header from '@/components/Home/Header/Header'
import ViewCounter from '@/components/Blog/ViewCounter'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dowankim.site'
const defaultOgImage = `${siteUrl}/images/og.webp`

interface PageProps {
  params: {
    tag: string
    slug: string
  }
}

const stripMarkdown = (markdown: string): string =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ') // 코드블럭 제거
    .replace(/`[^`]*`/g, ' ') // 인라인 코드 제거
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 이미지
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // 링크 -> 텍스트만
    .replace(/[#>*_~\-\+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const ensureAbsoluteUrl = (imageUrl: string): string =>
  imageUrl.startsWith('http') ? imageUrl : `${siteUrl}${imageUrl}`

const toDate = (value: Date | { toDate: () => Date }): Date =>
  value instanceof Date ? value : value.toDate()

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const decodedSlug = decodeURIComponent(params.slug)
  const decodedTag = decodeURIComponent(params.tag)
  const post = await getPostBySlug(decodedSlug)

  if (!post) {
    return {
      title: '게시글을 찾을 수 없습니다',
      description: '요청한 블로그 글이 존재하지 않습니다.',
    }
  }

  const plain = stripMarkdown(post.content)
  const description =
    plain.length > 160 ? `${plain.slice(0, 157).trim()}...` : plain || post.title
  const primaryImage = post.images?.[0] ? ensureAbsoluteUrl(post.images[0]) : defaultOgImage
  const canonicalUrl = `${siteUrl}/blog/${encodeURIComponent(decodedTag)}/${encodeURIComponent(
    decodedSlug
  )}`
  const createdAtDate = toDate(post.createdAt as Date | { toDate: () => Date })

  return {
    title: post.title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: 'article',
      title: post.title,
      description,
      url: canonicalUrl,
      siteName: 'Dowan Kim Portfolio',
      images: [
        {
          url: primaryImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
      tags: post.tags,
      publishedTime: createdAtDate.toISOString(),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [primaryImage],
    },
  }
}

// 항상 동적으로 렌더링하여 최신 데이터를 가져오도록 설정
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function BlogPostPage({ params }: PageProps) {
  const decodedSlug = decodeURIComponent(params.slug)
  const decodedTag = decodeURIComponent(params.tag)
  const post = await getPostBySlug(decodedSlug)

  if (!post) {
    notFound()
  }

  // 같은 태그의 모든 포스트 가져오기 (이전/다음 포스트 찾기용)
  const allPosts = await getPostsByTag(decodedTag)
  const currentIndex = allPosts.findIndex(p => p.id === post.id || p.slug === post.slug)
  
  // 이전 포스트 (더 최신 포스트, 인덱스가 작음)
  const prevPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null
  // 다음 포스트 (더 오래된 포스트, 인덱스가 큼)
  const nextPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null

  // Daily 태그인지 확인
  const isDaily = decodedTag === '일상'

  return (
    <>
      <Header />
      <article className="min-h-screen bg-[#050a13] text-white pt-32 px-4 pb-16">
        <div className="max-w-3xl mx-auto">
        {/* 네비게이션 버튼 */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          {!isDaily && (
            <Link 
              href="/blog"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[rgba(3,232,249,0.1)] border border-[rgba(3,232,249,0.2)] rounded-lg text-[#03e8f9] no-underline transition-all duration-300 hover:bg-[rgba(3,232,249,0.2)] hover:border-[#03e8f9] hover:-translate-y-0.5"
            >
              <span className="text-xl">←</span>
              <span>프로젝트 목록으로</span>
            </Link>
          )}
          {isDaily ? (
            <Link 
              href="/daily"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[rgba(3,232,249,0.1)] border border-[rgba(3,232,249,0.2)] rounded-lg text-[#03e8f9] no-underline transition-all duration-300 hover:bg-[rgba(3,232,249,0.2)] hover:border-[#03e8f9] hover:-translate-y-0.5"
            >
              <span className="text-xl">←</span>
              <span>Daily 목록으로</span>
            </Link>
          ) : (
            <Link 
              href={`/blog/${encodeURIComponent(decodedTag)}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[rgba(3,232,249,0.1)] border border-[rgba(3,232,249,0.2)] rounded-lg text-[#03e8f9] no-underline transition-all duration-300 hover:bg-[rgba(3,232,249,0.2)] hover:border-[#03e8f9] hover:-translate-y-0.5"
            >
              <span className="text-xl">←</span>
              <span>{decodedTag} 목록으로</span>
            </Link>
          )}
        </div>
        
        <header className="mb-12 pb-8 border-b border-[rgba(3,232,249,0.2)]">
          <h1 className="text-4xl text-white mb-4">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-white/60 mb-4">
            <span>
            {(() => {
              const date = post.createdAt instanceof Date 
                ? post.createdAt 
                : 'toDate' in post.createdAt 
                  ? (post.createdAt as { toDate: () => Date }).toDate()
                  : new Date(post.createdAt as string | number)
              return date.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            })()}
            </span>
            {post.id && (
              <ViewCounter postId={post.id} initialCount={post.viewCount ?? 0} />
            )}
          </div>
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="bg-[rgba(3,232,249,0.1)] text-[#03e8f9] px-3 py-1 rounded text-sm">{tag}</span>
              ))}
            </div>
          )}
        </header>
        
        {/* 상단 네비게이션 */}
        {(prevPost || nextPost) && (
          <nav className="flex justify-between gap-4 mb-12 pb-6 border-b border-[rgba(3,232,249,0.2)]">
            {prevPost ? (
              <Link 
                href={`/blog/${encodeURIComponent(decodedTag)}/${encodeURIComponent(prevPost.slug || prevPost.id || '')}`}
                className="flex items-center gap-4 px-6 py-4 bg-[rgba(3,232,249,0.05)] border border-[rgba(3,232,249,0.2)] rounded-lg no-underline text-inherit transition-all duration-300 flex-1 max-w-[48%] hover:bg-[rgba(3,232,249,0.1)] hover:border-[#03e8f9] hover:-translate-y-0.5"
              >
                <span className="text-2xl text-[#03e8f9] font-bold shrink-0">←</span>
                <div className="flex flex-col gap-2 overflow-hidden">
                  <span className="text-sm text-white/60 uppercase tracking-wider">이전 글</span>
                  <span className="text-base text-white font-medium overflow-hidden text-ellipsis whitespace-nowrap">{prevPost.title}</span>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-4 px-6 py-4 bg-[rgba(3,232,249,0.05)] border border-[rgba(3,232,249,0.2)] rounded-lg no-underline text-inherit transition-all duration-300 flex-1 max-w-[48%] invisible"></div>
            )}
            {nextPost ? (
              <Link 
                href={`/blog/${encodeURIComponent(decodedTag)}/${encodeURIComponent(nextPost.slug || nextPost.id || '')}`}
                className="flex items-center gap-4 px-6 py-4 bg-[rgba(3,232,249,0.05)] border border-[rgba(3,232,249,0.2)] rounded-lg no-underline text-inherit transition-all duration-300 flex-1 max-w-[48%] hover:bg-[rgba(3,232,249,0.1)] hover:border-[#03e8f9] hover:-translate-y-0.5 justify-end"
              >
                <div className="flex flex-col gap-2 overflow-hidden text-right">
                  <span className="text-sm text-white/60 uppercase tracking-wider">다음 글</span>
                  <span className="text-base text-white font-medium overflow-hidden text-ellipsis whitespace-nowrap">{nextPost.title}</span>
                </div>
                <span className="text-2xl text-[#03e8f9] font-bold shrink-0">→</span>
              </Link>
            ) : (
              <div className="flex items-center gap-4 px-6 py-4 bg-[rgba(3,232,249,0.05)] border border-[rgba(3,232,249,0.2)] rounded-lg no-underline text-inherit transition-all duration-300 flex-1 max-w-[48%] invisible"></div>
            )}
          </nav>
        )}
        
        <div className="leading-[1.8] text-lg [&_h1]:text-white [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:text-3xl [&_h2]:text-white [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:text-2xl [&_h3]:text-white [&_h3]:mt-8 [&_h3]:mb-4 [&_h3]:text-xl [&_h4]:text-white [&_h4]:mt-8 [&_h4]:mb-4 [&_h5]:text-white [&_h5]:mt-8 [&_h5]:mb-4 [&_h6]:text-white [&_h6]:mt-8 [&_h6]:mb-4 [&_p]:mb-6 [&_ul]:mb-6 [&_ol]:mb-6 [&_ul]:pl-8 [&_ol]:pl-8 [&_li]:mb-2 [&_code]:bg-[rgba(3,232,249,0.1)] [&_code]:text-[#03e8f9] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_pre]:bg-[#1b1e26] [&_pre]:p-6 [&_pre]:rounded-none [&_pre]:overflow-x-auto [&_pre]:mb-6 [&_pre]:border-none [&_pre]:shadow-none [&_pre_code]:bg-transparent [&_pre_code]:text-white [&_pre_code]:p-0 [&_blockquote]:border-l-4 [&_blockquote]:border-[#03e8f9] [&_blockquote]:pl-6 [&_blockquote]:my-6 [&_blockquote]:text-white/80 [&_blockquote]:italic [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-8 [&_a]:text-[#03e8f9] [&_a]:underline hover:[&_a]:text-white [&_table]:w-full [&_table]:border-collapse [&_table]:my-6 [&_th]:border [&_th]:border-[rgba(3,232,249,0.2)] [&_th]:p-3 [&_th]:text-left [&_th]:bg-[rgba(3,232,249,0.1)] [&_th]:text-[#03e8f9] [&_td]:border [&_td]:border-[rgba(3,232,249,0.2)] [&_td]:p-3 [&_td]:text-left">
          <ReactMarkdown
            rehypePlugins={[rehypeRaw]}
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ ...props }) => (
                <a {...props} target="_blank" rel="noopener noreferrer" />
              ),
              code: ({ className, children, ...props }) => {
                const match = /language-(\w+)/.exec(className || '')
                const language = match ? match[1] : ''
                const isInline = !match
                
                if (!isInline && match) {
                  return (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={language}
                      PreTag="div"
                      customStyle={{
                        background: 'transparent',
                        padding: 0,
                        margin: 0,
                        border: 'none',
                        boxShadow: 'none',
                      }}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  )
                }
                
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              },
            } satisfies Components}
          >
            {post.content}
          </ReactMarkdown>
        </div>
        
        {/* 하단 네비게이션 */}
        {(prevPost || nextPost) && (
          <nav className="flex justify-between gap-4 my-12 py-6 border-t border-b border-[rgba(3,232,249,0.2)]">
            {prevPost ? (
              <Link 
                href={`/blog/${encodeURIComponent(decodedTag)}/${encodeURIComponent(prevPost.slug || prevPost.id || '')}`}
                className="flex items-center gap-4 px-6 py-4 bg-[rgba(3,232,249,0.05)] border border-[rgba(3,232,249,0.2)] rounded-lg no-underline text-inherit transition-all duration-300 flex-1 max-w-[48%] hover:bg-[rgba(3,232,249,0.1)] hover:border-[#03e8f9] hover:-translate-y-0.5"
              >
                <span className="text-2xl text-[#03e8f9] font-bold shrink-0">←</span>
                <div className="flex flex-col gap-2 overflow-hidden">
                  <span className="text-sm text-white/60 uppercase tracking-wider">이전 글</span>
                  <span className="text-base text-white font-medium overflow-hidden text-ellipsis whitespace-nowrap">{prevPost.title}</span>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-4 px-6 py-4 bg-[rgba(3,232,249,0.05)] border border-[rgba(3,232,249,0.2)] rounded-lg no-underline text-inherit transition-all duration-300 flex-1 max-w-[48%] invisible"></div>
            )}
            {nextPost ? (
              <Link 
                href={`/blog/${encodeURIComponent(decodedTag)}/${encodeURIComponent(nextPost.slug || nextPost.id || '')}`}
                className="flex items-center gap-4 px-6 py-4 bg-[rgba(3,232,249,0.05)] border border-[rgba(3,232,249,0.2)] rounded-lg no-underline text-inherit transition-all duration-300 flex-1 max-w-[48%] hover:bg-[rgba(3,232,249,0.1)] hover:border-[#03e8f9] hover:-translate-y-0.5 justify-end"
              >
                <div className="flex flex-col gap-2 overflow-hidden text-right">
                  <span className="text-sm text-white/60 uppercase tracking-wider">다음 글</span>
                  <span className="text-base text-white font-medium overflow-hidden text-ellipsis whitespace-nowrap">{nextPost.title}</span>
                </div>
                <span className="text-2xl text-[#03e8f9] font-bold shrink-0">→</span>
              </Link>
            ) : (
              <div className="flex items-center gap-4 px-6 py-4 bg-[rgba(3,232,249,0.05)] border border-[rgba(3,232,249,0.2)] rounded-lg no-underline text-inherit transition-all duration-300 flex-1 max-w-[48%] invisible"></div>
            )}
          </nav>
        )}
      </div>
      </article>
    </>
  )
}


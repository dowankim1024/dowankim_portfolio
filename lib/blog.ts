import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  orderBy,
  where,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentSnapshot,
  Timestamp,
  increment,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from './firebase'
import { BlogPost, Project } from '@/types/blog'

const POSTS_COLLECTION = 'posts'
const PROJECTS_COLLECTION = 'projects'

// Firestore 문서 -> BlogPost (Timestamp는 Date로 변환해 서버/클라이언트 경계를 넘길 수 있게 함)
const toBlogPost = (snap: QueryDocumentSnapshot | DocumentSnapshot): BlogPost => {
  const data = snap.data() as Record<string, unknown>
  const post = {
    id: snap.id,
    ...data,
    createdAt: (data.createdAt as Timestamp).toDate(),
    updatedAt: (data.updatedAt as Timestamp).toDate(),
  } as BlogPost
  if (data.lastViewedAt instanceof Timestamp) {
    post.lastViewedAt = data.lastViewedAt.toDate()
  }
  return post
}

// 모든 포스트 가져오기 (공개된 것만)
export const getPublishedPosts = async (): Promise<BlogPost[]> => {
  const q = query(
    collection(db, POSTS_COLLECTION),
    where('published', '==', true),
    orderBy('createdAt', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(toBlogPost)
}

// 전체 포스트 가져오기 (페이지네이션, 공개된 것만, 최신순)
export const getPublishedPostsPaginated = async (
  pageSize: number = 12,
  lastDoc?: QueryDocumentSnapshot
): Promise<{ posts: BlogPost[], lastDoc: QueryDocumentSnapshot | null, hasMore: boolean }> => {
  let q = query(
    collection(db, POSTS_COLLECTION),
    where('published', '==', true),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1)
  )

  if (lastDoc) {
    q = query(
      collection(db, POSTS_COLLECTION),
      where('published', '==', true),
      orderBy('createdAt', 'desc'),
      startAfter(lastDoc),
      limit(pageSize + 1)
    )
  }

  const snapshot = await getDocs(q)
  const docs = snapshot.docs
  const hasMore = docs.length > pageSize
  const postsToReturn = hasMore ? docs.slice(0, pageSize) : docs

  const posts = postsToReturn.map(toBlogPost)

  const lastDocument = postsToReturn.length > 0 ? docs[postsToReturn.length - 1] : null

  return {
    posts,
    lastDoc: lastDocument,
    hasMore
  }
}

// 모든 포스트 가져오기 (관리자용)
export const getAllPosts = async (): Promise<BlogPost[]> => {
  try {
    const q = query(
      collection(db, POSTS_COLLECTION),
      orderBy('createdAt', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(toBlogPost)
  } catch (error) {
    console.error('포스트 가져오기 실패:', error)
    // 권한 에러 등으로 실패하면 빈 배열 반환
    return []
  }
}

// 단일 포스트 가져오기
export const getPost = async (id: string): Promise<BlogPost | null> => {
  const docRef = doc(db, POSTS_COLLECTION, id)
  const docSnap = await getDoc(docRef)
  
  if (!docSnap.exists()) {
    return null
  }
  
  return toBlogPost(docSnap)
}

// 이미지 업로드
export const uploadImage = async (file: File, postId: string): Promise<string> => {
  const fileName = `${postId}/${Date.now()}_${file.name}`
  const storageRef = ref(storage, `blog-images/${fileName}`)
  await uploadBytes(storageRef, file)
  return await getDownloadURL(storageRef)
}

// 여러 이미지 업로드
export const uploadImages = async (files: File[], postId: string): Promise<string[]> => {
  const uploadPromises = files.map(file => uploadImage(file, postId))
  return Promise.all(uploadPromises)
}

// 포스트 생성
export const createPost = async (postData: Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: Date | Timestamp }): Promise<string> => {
  const now = Timestamp.now()
  // createdAt이 제공되면 사용, 없으면 현재 시간 사용
  const createdAtTimestamp = postData.createdAt 
    ? (postData.createdAt instanceof Date ? Timestamp.fromDate(postData.createdAt) : postData.createdAt)
    : now
  
  // createdAt을 제외한 나머지 데이터만 사용
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { createdAt: _createdAt, ...restPostData } = postData
  
  const docRef = await addDoc(collection(db, POSTS_COLLECTION), {
    ...restPostData,
    createdAt: createdAtTimestamp,
    updatedAt: now,
  })
  return docRef.id
}

// 포스트 업데이트
export const updatePost = async (id: string, postData: Partial<BlogPost> & { createdAt?: Date | Timestamp }): Promise<void> => {
  const docRef = doc(db, POSTS_COLLECTION, id)
  
  // createdAt이 제공되면 Timestamp로 변환
  const updateData: Record<string, unknown> = { ...postData }
  if (updateData.createdAt) {
    updateData.createdAt = updateData.createdAt instanceof Date 
      ? Timestamp.fromDate(updateData.createdAt) 
      : updateData.createdAt
  }
  
  updateData.updatedAt = Timestamp.now()
  
  await updateDoc(docRef, updateData)
}

// 포스트 삭제
export const deletePost = async (id: string, imageUrls: string[]): Promise<void> => {
  // Firestore에서 삭제
  const docRef = doc(db, POSTS_COLLECTION, id)
  await deleteDoc(docRef)
  
  // Storage에서 이미지 삭제
  const deleteImagePromises = imageUrls.map(url => {
    const imageRef = ref(storage, url)
    return deleteObject(imageRef).catch(() => {
      // 이미지 삭제 실패해도 계속 진행
    })
  })
  await Promise.all(deleteImagePromises)
}

// Slug로 포스트 가져오기
export const getPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  // URL 인코딩된 slug를 디코딩
  const decodedSlug = decodeURIComponent(slug)
  
  const q = query(
    collection(db, POSTS_COLLECTION),
    where('slug', '==', decodedSlug),
    where('published', '==', true)
  )
  const snapshot = await getDocs(q)
  
  if (snapshot.empty) {
    return null
  }
  
  return toBlogPost(snapshot.docs[0])
}

// 특정 태그의 포스트 가져오기
export const getPostsByTag = async (tag: string): Promise<BlogPost[]> => {
  const q = query(
    collection(db, POSTS_COLLECTION),
    where('tags', 'array-contains', tag),
    where('published', '==', true),
    orderBy('createdAt', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(toBlogPost)
}

// 특정 태그의 포스트 가져오기 (페이지네이션)
export const getPostsByTagPaginated = async (
  tag: string,
  pageSize: number = 12,
  lastDoc?: QueryDocumentSnapshot
): Promise<{ posts: BlogPost[], lastDoc: QueryDocumentSnapshot | null, hasMore: boolean }> => {
  let q = query(
    collection(db, POSTS_COLLECTION),
    where('tags', 'array-contains', tag),
    where('published', '==', true),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1) // 한 개 더 가져와서 hasMore 확인
  )

  if (lastDoc) {
    q = query(
      collection(db, POSTS_COLLECTION),
      where('tags', 'array-contains', tag),
      where('published', '==', true),
      orderBy('createdAt', 'desc'),
      startAfter(lastDoc),
      limit(pageSize + 1)
    )
  }

  const snapshot = await getDocs(q)
  const docs = snapshot.docs
  const hasMore = docs.length > pageSize
  const postsToReturn = hasMore ? docs.slice(0, pageSize) : docs

  const posts = postsToReturn.map(toBlogPost)

  // lastDoc은 원본 DocumentSnapshot을 반환해야 함
  const lastDocument = postsToReturn.length > 0 ? docs[postsToReturn.length - 1] : null

  return {
    posts,
    lastDoc: lastDocument,
    hasMore
  }
}

// 모든 프로젝트(태그) 가져오기
export const getAllProjects = async (): Promise<Project[]> => {
  try {
    const q = query(
      collection(db, PROJECTS_COLLECTION),
      orderBy('createdAt', 'desc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate(),
    })) as Project[]
  } catch (error) {
    console.error('프로젝트 가져오기 실패:', error)
    // 권한 에러 등으로 실패하면 빈 배열 반환
    return []
  }
}

// 특정 태그의 프로젝트 가져오기
export const getProjectByTag = async (tag: string): Promise<Project | null> => {
  try {
    const q = query(
      collection(db, PROJECTS_COLLECTION),
      where('tag', '==', tag)
    )
    const snapshot = await getDocs(q)
    
    if (snapshot.empty) {
      return null
    }
    
    const doc = snapshot.docs[0]
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate(),
    } as Project
  } catch (error) {
    console.error('프로젝트 가져오기 실패:', error)
    // 권한 에러 등으로 실패하면 null 반환
    return null
  }
}

// 프로젝트 생성 또는 업데이트
export const upsertProject = async (tag: string, description: string): Promise<string> => {
  const q = query(
    collection(db, PROJECTS_COLLECTION),
    where('tag', '==', tag)
  )
  const snapshot = await getDocs(q)
  
  const now = Timestamp.now()
  
  if (snapshot.empty) {
    // 새 프로젝트 생성
    const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
      tag,
      description,
      createdAt: now,
      updatedAt: now,
    })
    return docRef.id
  } else {
    // 기존 프로젝트 업데이트
    const docRef = snapshot.docs[0].ref
    const existingData = snapshot.docs[0].data()
    
    // 빈 문자열이 전달되면 기존 description 유지
    const updateData: Record<string, unknown> = {
      updatedAt: now,
    }
    
    // description이 빈 문자열이 아니거나, 기존에 description이 없을 때만 업데이트
    if (description.trim() !== '' || !existingData.description) {
      updateData.description = description
    }
    
    await updateDoc(docRef, updateData)
    return docRef.id
  }
}

// 프로젝트 업데이트
export const updateProject = async (id: string, description: string): Promise<void> => {
  const docRef = doc(db, PROJECTS_COLLECTION, id)
  await updateDoc(docRef, {
    description,
    updatedAt: Timestamp.now(),
  })
}

// 모든 태그 목록 가져오기 (포스트에서 사용된 태그 + 프로젝트 컬렉션의 태그)
export const getAllTags = async (): Promise<string[]> => {
  const tagSet = new Set<string>()
  
  // 포스트에서 태그 가져오기
  const posts = await getPublishedPosts()
  posts.forEach(post => {
    if (post.tags) {
      post.tags.forEach(tag => tagSet.add(tag))
    }
  })
  
  // 프로젝트 컬렉션에서 태그 가져오기
  const projects = await getAllProjects()
  projects.forEach(project => {
    if (project.tag) {
      tagSet.add(project.tag)
    }
  })
  
  return Array.from(tagSet).sort()
}

// ===== 조회수 =====

// 조회수 +1 (방문자용)
// Firestore 보안 규칙에서 비로그인 사용자는 viewCount(+1)와 lastViewedAt만 바꿀 수 있도록 제한함 (firestore.rules 참고)
export const incrementPostView = async (postId: string): Promise<void> => {
  const docRef = doc(db, POSTS_COLLECTION, postId)
  await updateDoc(docRef, {
    viewCount: increment(1),
    lastViewedAt: serverTimestamp(),
  })
}

// 조회수 직접 설정 (관리자용). updatedAt은 건드리지 않음
export const setPostViewCount = async (postId: string, viewCount: number): Promise<void> => {
  const docRef = doc(db, POSTS_COLLECTION, postId)
  await updateDoc(docRef, { viewCount })
}

// viewCount가 아직 없는 글에 초기값을 한 번에 부여 (관리자용, 1회성)
// min~max 사이의 무작위 정수를 넣고, 처리한 글 개수를 반환
export const seedMissingViewCounts = async (
  posts: BlogPost[],
  min: number = 20,
  max: number = 90
): Promise<number> => {
  const targets = posts.filter(post => post.id && typeof post.viewCount !== 'number')
  if (targets.length === 0) return 0

  const batch = writeBatch(db)
  targets.forEach(post => {
    const viewCount = min + Math.floor(Math.random() * (max - min + 1))
    batch.update(doc(db, POSTS_COLLECTION, post.id as string), { viewCount })
  })
  await batch.commit()
  return targets.length
}

import type{Metadata}from 'next';
import './globals.css';
export const metadata:Metadata={title:'Studyroom — Your material. Your study guide.',description:'Turn slides, PDFs, and notes into focused study guides, knowledge checks, flashcards, and quizzes.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}

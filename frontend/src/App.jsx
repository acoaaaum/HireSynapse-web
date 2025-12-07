import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { DictionaryProvider } from './contexts/DictionaryContext'
import { ToastProvider } from './components/Toast'
import MainPage from './pages/MainPage'
import ReviewPage from './pages/ReviewPage'
import HistoryPage from './pages/HistoryPage'

function App() {
    return (
        <Router>
            <ToastProvider>
                <DictionaryProvider>
                    <Routes>
                        <Route path="/" element={<MainPage />} />
                        <Route path="/review" element={<ReviewPage />} />
                        <Route path="/history" element={<HistoryPage />} />
                    </Routes>
                </DictionaryProvider>
            </ToastProvider>
        </Router>
    )
}

export default App

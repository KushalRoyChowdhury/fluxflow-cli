import { Routes, Route, Navigate } from 'react-router-dom'
import DocLayout from './components/DocLayout'
import Introduction from './pages/Introduction'
import GettingStarted from './pages/GettingStarted'
import Architecture from './pages/Architecture'
import Tools from './pages/Tools'

function App() {
    return (
        <Routes>
            <Route element={<DocLayout />}>
                <Route index element={<Introduction />} />
                <Route path="getting-started" element={<GettingStarted />} />
                <Route path="architecture" element={<Architecture />} />
                <Route path="tools" element={<Tools />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    )
}

export default App

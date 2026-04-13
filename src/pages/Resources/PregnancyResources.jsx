import React, { useState } from 'react';
import {
    Plus, Search, LayoutGrid, List, MoreVertical,
    Edit2, Trash2, Eye, X, Filter, ChevronRight,
    FileText, Video, ClipboardList, CheckSquare,
    Globe, Lock, Archive, Clock
} from 'lucide-react';
import { TIPS_DATA } from '../MotherDashboard/PregnancyTips';
import '../../styles/pages/PregnancyResources.css';

const CATEGORIES = [
    'All', 'Nutrition', 'Prenatal Care', 'Postpartum Care',
    'Mental Health & Wellness', 'Newborn Care'
];

const PregnancyResources = () => {
    const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [showAddModal, setShowAddModal] = useState(false);
    const [resources, setResources] = useState([...TIPS_DATA].map(t => ({
        ...t,
        status: 'Published',
        type: 'Article',
        dateAdded: 'Feb 26, 2026',
        author: 'CHO Admin'
    })));

    const [newResource, setNewResource] = useState({
        title: '',
        category: 'Prenatal Care',
        description: '',
        status: 'Draft',
        type: 'Article'
    });

    const filteredResources = resources.filter(res => {
        const matchesSearch = res.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            res.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategory === 'All' || res.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    const handleAddResource = () => {
        const res = {
            ...newResource,
            id: (resources.length + 1).toString(),
            dateAdded: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            author: 'CHO Admin',
            icon: <FileText size={22} />,
            colorClass: `cat-${newResource.category.split(' ')[0].toLowerCase()}`
        };
        setResources([res, ...resources]);
        setShowAddModal(false);
        setNewResource({
            title: '',
            category: 'Prenatal Care',
            description: '',
            status: 'Draft',
            type: 'Article'
        });
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this resource?')) {
            setResources(resources.filter(r => r.id !== id));
        }
    };

    return (
        <div className="pr-page">
            {/* ── Header ── */}
            <div className="pr-header">
                <div className="pr-header-title">
                    <h1>Pregnancy Resources</h1>
                    <p>Manage educational content for mothers using the DasMom+ app.</p>
                </div>
                <div className="pr-actions">
                    <button className="pr-btn-add" onClick={() => setShowAddModal(true)}>
                        <Plus size={18} /> Add New Resource
                    </button>
                </div>
            </div>

            {/* ── Controls ── */}
            <div className="pr-controls">
                <div className="pr-search-wrap">
                    <Search size={18} className="pr-search-ico" />
                    <input
                        type="text"
                        className="pr-search-input"
                        placeholder="Search resources by title or keywords..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="pr-filter-group">
                    <div className="pr-view-toggle">
                        <button
                            className={`pr-view-btn ${viewMode === 'table' ? 'active' : ''}`}
                            onClick={() => setViewMode('table')}
                            title="Table View"
                        >
                            <List size={18} />
                        </button>
                        <button
                            className={`pr-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                            onClick={() => setViewMode('grid')}
                            title="Grid View"
                        >
                            <LayoutGrid size={18} />
                        </button>
                    </div>

                    <select
                        className="pr-select"
                        style={{ width: '180px' }}
                        value={activeCategory}
                        onChange={(e) => setActiveCategory(e.target.value)}
                    >
                        {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Content ── */}
            {viewMode === 'table' ? (
                <div className="pr-table-container">
                    <table className="pr-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Category</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Date Added</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredResources.map(res => (
                                <tr key={res.id}>
                                    <td>
                                        <div className="pr-resource-cell">
                                            <div className="pr-resource-icon">
                                                {res.type === 'Video' ? <Video size={16} /> : <FileText size={16} />}
                                            </div>
                                            <strong>{res.title}</strong>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`pr-status ${res.colorClass || 'cat-prenatal'}`}>
                                            {res.category}
                                        </span>
                                    </td>
                                    <td>{res.type}</td>
                                    <td>
                                        <span className={`pr-status pr-status--${res.status.toLowerCase()}`}>
                                            {res.status}
                                        </span>
                                    </td>
                                    <td>{res.dateAdded}</td>
                                    <td>
                                        <div className="pr-table-actions">
                                            <button className="pr-icon-btn" title="View Preview">
                                                <Eye size={14} />
                                            </button>
                                            <button className="pr-icon-btn" title="Edit">
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                className="pr-icon-btn"
                                                title="Delete"
                                                onClick={() => handleDelete(res.id)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="pr-grid">
                    {filteredResources.map(res => (
                        <div key={res.id} className="pr-card">
                            <div className={`pr-card-cover ${res.colorClass || 'cat-prenatal'}`}>
                                {res.icon || <FileText size={40} />}
                                <div className="pr-card-status">
                                    <span className={`pr-status pr-status--${res.status.toLowerCase()}`}>
                                        {res.status}
                                    </span>
                                </div>
                            </div>
                            <div className="pr-card-body">
                                <span className="pr-card-meta">{res.category}</span>
                                <h3>{res.title}</h3>
                                <p>{res.description}</p>
                            </div>
                            <div className="pr-card-footer">
                                <div className="pr-card-meta">
                                    <Clock size={12} /> {res.dateAdded}
                                </div>
                                <div className="pr-table-actions">
                                    <button className="pr-icon-btn" title="Edit">
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        className="pr-icon-btn"
                                        title="Delete"
                                        onClick={() => handleDelete(res.id)}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Add Resource Modal ── */}
            {showAddModal && (
                <div className="pr-modal-overlay">
                    <div className="pr-modal">
                        <div className="pr-modal-header">
                            <h2>Add New Resource</h2>
                            <button className="pr-modal-close" onClick={() => setShowAddModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="pr-modal-body">
                            <div className="pr-form-group">
                                <label className="pr-label">Title</label>
                                <input
                                    type="text"
                                    className="pr-input"
                                    placeholder="Enter resource title..."
                                    value={newResource.title}
                                    onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
                                />
                            </div>

                            <div className="pr-form-grid">
                                <div className="pr-form-group">
                                    <label className="pr-label">Category</label>
                                    <select
                                        className="pr-select"
                                        value={newResource.category}
                                        onChange={(e) => setNewResource({ ...newResource, category: e.target.value })}
                                    >
                                        {CATEGORIES.filter(c => c !== 'All').map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="pr-form-group">
                                    <label className="pr-label">Type</label>
                                    <select
                                        className="pr-select"
                                        value={newResource.type}
                                        onChange={(e) => setNewResource({ ...newResource, type: e.target.value })}
                                    >
                                        <option value="Article">Article</option>
                                        <option value="Video">Video</option>
                                        <option value="PDF">PDF</option>
                                        <option value="Checklist">Checklist</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pr-form-group">
                                <label className="pr-label">Description / Teaser</label>
                                <textarea
                                    className="pr-textarea"
                                    placeholder="Brief summary for the card view..."
                                    value={newResource.description}
                                    onChange={(e) => setNewResource({ ...newResource, description: e.target.value })}
                                ></textarea>
                            </div>

                            <div className="pr-form-group">
                                <label className="pr-label">Status</label>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                                        <input
                                            type="radio"
                                            name="status"
                                            checked={newResource.status === 'Draft'}
                                            onChange={() => setNewResource({ ...newResource, status: 'Draft' })}
                                        /> Draft
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                                        <input
                                            type="radio"
                                            name="status"
                                            checked={newResource.status === 'Published'}
                                            onChange={() => setNewResource({ ...newResource, status: 'Published' })}
                                        /> Published
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="pr-modal-footer">
                            <button className="pr-btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className="pr-btn-save" onClick={handleAddResource}>Save &amp; Publish</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PregnancyResources;

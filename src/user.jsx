import React, { useEffect, useMemo, useState, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import './globals.css'
import { getDeviceInfo } from './fingerprint'

function InviteForm(){
  const [formData,setFormData]=useState({name:'',email:'',whatsapp:'',password:''})
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  const [deviceInfo,setDeviceInfo]=useState(null)

  useEffect(()=>{
    getDeviceInfo().then(info=>setDeviceInfo(info))
  },[])

  const submit=async(e)=>{
    e.preventDefault()
    setError('')

    if(!formData.name.trim()){setError('Name is required');return}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)){setError('Invalid email');return}
    if(formData.password.length<6){setError('Password must be at least 6 characters');return}
    if(!deviceInfo){setError('Device fingerprint not ready. Please wait...');return}

    setLoading(true)
    try{
      const r=await fetch('/api/auth/register',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({...formData,...deviceInfo})})
      const j=await r.json()
      if(j.success){window.location.href='/'}else{setError(j.error||'Failed to submit')}
    }catch(e){setError('Network error: '+e.message)}finally{setLoading(false)}
  }

  return(
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">T</div>
          <h1 className="auth-title">Request Access</h1>
          <p className="auth-subtitle">Join TubeKit - Invite Only</p>
        </div>

        <form onSubmit={submit} className="auth-form">
          {error&&(
            <div className="auth-error">{error}</div>
          )}

          <div className="auth-field">
            <label className="auth-label">Full Name</label>
            <input value={formData.name} onChange={e=>setFormData({...formData,name:e.target.value})} placeholder="Enter your name" className="auth-input" required/>
          </div>

          <div className="auth-field">
            <label className="auth-label">Email Address</label>
            <input type="email" value={formData.email} onChange={e=>setFormData({...formData,email:e.target.value})} placeholder="Enter your email" className="auth-input" required/>
          </div>

          <div className="auth-field">
            <label className="auth-label">WhatsApp Number (Optional)</label>
            <input value={formData.whatsapp} onChange={e=>setFormData({...formData,whatsapp:e.target.value})} placeholder="Enter your number" className="auth-input"/>
          </div>

          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input type="password" value={formData.password} onChange={e=>setFormData({...formData,password:e.target.value})} placeholder="Create a password (min 6 characters)" className="auth-input" required/>
          </div>

          <button type="submit" disabled={loading} className="auth-btn">
            {loading?'Submitting...':'Request Access'}
          </button>
        </form>

        <div className="auth-footer">
          <p className="auth-footer-text">
            Already have an account?{' '}
            <a href="/login" className="auth-link">Sign In</a>
          </p>
        </div>
      </div>
    </div>
  )
}

function PendingScreen(){
  return(
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo" style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}}>⏳</div>
          <h1 className="auth-title" style={{color:'#f59e0b'}}>Approval Pending</h1>
          <p className="auth-subtitle">Your request is being reviewed</p>
        </div>
        <div style={{textAlign:'center',fontSize:'14px',color:'var(--text-muted)',lineHeight:'1.6'}}>
          We'll review your request within 24 hours. Contact us on WhatsApp for faster approval.
        </div>
      </div>
    </div>
  )
}

function Header({ user, onProfileClick, onAddSerial }){
  return(
    <header className="header">
      <div className="brand">
        <div className="logo">T</div>
        <div>
          <div className="title">TubeKit</div>
          <div className="subtitle">Serials Download</div>
        </div>
      </div>
      <div className="controls">
        <button className="btn btn-add" onClick={onAddSerial}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add Serial
        </button>
        <button className="btn" onClick={onProfileClick}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          Profile
        </button>
      </div>
    </header>
  )
}

function Toolbar({ platforms, activeChannel, onChannelChange, searchQuery, onSearchChange, totalItems }){
  return(
    <div className="toolbar">
      <div className="chips">
        {platforms.map(platform=>(
          <div key={platform.id} className={`chip ${activeChannel===platform.id?'active':''}`} onClick={()=>onChannelChange(platform.id)}>
            {platform.name.toUpperCase()}
          </div>
        ))}
      </div>
      <div className="footer">
        <div className="input">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="#6b7380" strokeWidth="1.6"/>
            <path d="M21 21l-4.35-4.35" stroke="#6b7380" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input placeholder="Search" value={searchQuery} onChange={e=>onSearchChange(e.target.value)} />
        </div>
        <span>{totalItems} items</span>
      </div>
    </div>
  )
}

function SerialCard({ serial, onClick, onRemove }){
  return(
    <div className="card">
      <button className="card-remove" onClick={e=>{e.stopPropagation();onRemove(serial)}} title="Remove from dashboard">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div className="serial-name">{serial.name}</div>
      <div className="episode" onClick={onClick}>
        <div className="ep-left">
          <div className="ep-title">Latest Episode</div>
          <div className="ep-date">{serial.date||'Not available'}</div>
        </div>
        <button className="dl-btn">
          <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
      </div>
    </div>
  )
}

function AddSerialModal({ onClose, onAdd }){
  const [allSerials,setAllSerials]=useState([])
  const [loading,setLoading]=useState(true)
  const [searchQuery,setSearchQuery]=useState('')
  const [selectedPlatform,setSelectedPlatform]=useState('all')

  useEffect(()=>{
    fetch('/api/serials/available',{credentials:'include'})
      .then(r=>{
        if(r.status===401){
          window.location.href='/login?message=session-expired'
          return
        }
        return r.json()
      })
      .then(j=>{
        if(!j) return
        setAllSerials(j.serials||[])
        setLoading(false)
      })
      .catch(()=>setLoading(false))
  },[])

  const platforms=useMemo(()=>{
    const map={}
    allSerials.forEach(s=>{
      if(!map[s.platform_slug]) map[s.platform_slug]={id:s.platform_slug,name:s.platform_name,serials:[]}
      map[s.platform_slug].serials.push(s)
    })
    return Object.values(map)
  },[allSerials])

  const filteredSerials=useMemo(()=>{
    let filtered=allSerials
    if(selectedPlatform!=='all') filtered=filtered.filter(s=>s.platform_slug===selectedPlatform)
    if(searchQuery) filtered=filtered.filter(s=>s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    return filtered
  },[allSerials,selectedPlatform,searchQuery])

  const handleAdd=async(serialId)=>{
    try{
      const r=await fetch('/api/serials/add',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({serialId})})
      if(r.status===401){
        window.location.href='/login?message=session-expired'
        return
      }
      const data=await r.json()
      if(data.success){
        setAllSerials(prev=>prev.map(s=>s.id===serialId?{...s,isAdded:true}:s))
        onAdd()
      }else alert(data.error||'Failed to add serial')
    }catch(e){alert('Network error: '+e.message)}
  }

  return(
    <div className="modal-bg show">
      <div className="modal add-serial-modal">
        <button className="modal-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className="modal-hdr">
          <div className="modal-icon">
            <svg viewBox="0 0 24 24" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" stroke="currentColor"/>
            </svg>
          </div>
        <div className="modal-title">Add Serial</div>
          <div className="modal-subtitle">Choose serials to add to your dashboard</div>
        </div>

        <div className="add-serial-filters">
          <div className="input">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="#6b7380" strokeWidth="1.6"/>
              <path d="M21 21l-4.35-4.35" stroke="#6b7380" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <input placeholder="Search serials..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
          </div>
          <div className="platform-pills">
            <button className={`pill ${selectedPlatform==='all'?'active':''}`} onClick={()=>setSelectedPlatform('all')}>
              All
            </button>
            {platforms.map(p=>(
              <button key={p.id} className={`pill ${selectedPlatform===p.id?'active':''}`} onClick={()=>setSelectedPlatform(p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="serial-list">
          {loading?(
            <div className="loading-state">Loading serials...</div>
          ):filteredSerials.length===0?(
            <div className="empty-state">No serials found</div>
          ):(
            filteredSerials.map(serial=>(
              <div key={serial.id} className="serial-item">
                <div className="serial-item-info">
                  <div className="serial-item-name">{serial.name}</div>
                  <div className="serial-item-platform">{serial.platform_name}</div>
                </div>
                <button
                  className={`serial-item-btn ${serial.isAdded?'added':''}`}
                  onClick={()=>!serial.isAdded&&handleAdd(serial.id)}
                  disabled={serial.isAdded}
                >
                  {serial.isAdded?(
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      Added
                    </>
                  ):(
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                      Add
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function DownloadModal({ serial, onClose, onDownload }){
  return(
    <div className="modal-bg show">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div className="modal-hdr">
          <div className="modal-icon">
            <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </div>
          <div className="modal-title">Select Version</div>
          <div className="modal-subtitle">Choose your preferred download option for {serial.name}</div>
        </div>
        <div className="modal-btns">
          <button className="modal-btn primary" onClick={()=>onDownload('original')}>
            <span>Original Episode</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <button className="modal-btn secondary" onClick={()=>onDownload('bypass')}>
            <span>Half Screen [BYPASS]</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <button className="modal-btn secondary" onClick={()=>window.open(`https://dl.tubekit.net/thumbnail_${serial.id}.jpg`,'_blank')}>
            <span>Thumbnail</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function ProcessingModal({ type, progress, onClose }){
  const showProgress=progress>0
  return(
    <div className="modal-bg download-modal show">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div className="modal-hdr">
          {!showProgress&&<div className="spinner"></div>}
          <div className="modal-title">{showProgress?'Processing Video':'Processing...'}</div>
          <div className="modal-subtitle">{type==='bypass'?'Please wait 3-5 minutes while we edit the video on our servers':'Preparing your download, this will take a moment'}</div>
          {showProgress&&(
            <div className="progress-wrap show">
              <div className="progress-bar">
                <div className="progress-fill" style={{width:`${progress}%`}}></div>
              </div>
              <div className="progress-info">
                <span className="progress-percent">{progress}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ErrorModal({ onClose }){
  return(
    <div className="modal-bg download-modal show">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div className="modal-hdr">
          <div className="modal-icon error">
            <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
          <div className="modal-title">Download Failed</div>
          <div className="modal-subtitle">Failed to download episode from OTT Platform server. Please try again after few minutes</div>
        </div>
      </div>
    </div>
  )
}

function ExpiredPlanModal(){
  return(
    <div className="modal-bg show" style={{ zIndex: 9999 }}>
      <div className="modal" style={{ maxWidth: '450px' }}>
        <div className="modal-hdr">
          <div className="modal-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div className="modal-title" style={{ color: '#f59e0b' }}>Your Plan has been expired</div>
          <div className="modal-subtitle" style={{ marginBottom: '24px' }}>Please contact for renew your plan</div>
          
          <div style={{ 
            background: '#fef3c7', 
            border: '1px solid #fbbf24', 
            borderRadius: '12px', 
            padding: '16px', 
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '13px', color: '#92400e', fontWeight: '600', marginBottom: '8px' }}>
              Contact Number
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#78350f', letterSpacing: '0.5px' }}>
              +92 340 4598850
            </div>
          </div>

          <a 
            href="https://wa.me/923404598850" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              width: '100%',
              padding: '14px 24px',
              background: '#25D366',
              color: 'white',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '600',
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Contact on WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}

function Toast({ serialName }){
  return(
    <div className="toast show">
      <div className="toast-icon">
        <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </div>
      <div className="toast-content">
        <div className="toast-title">{serialName}</div>
        <div className="toast-msg">Download started successfully</div>
      </div>
    </div>
  )
}

function ProfileModal({ user, onClose }){
  return(
    <div className="modal-bg show">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div className="modal-hdr">
          <div className="modal-icon">
            <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div className="modal-title">User Profile</div>
          <div className="modal-subtitle">Your account information</div>
        </div>
        <div className="profile-info">
          <div className="profile-item">
            <div className="profile-label">Full Name</div>
            <div className="profile-value">{user.name}</div>
          </div>
          <div className="profile-item">
            <div className="profile-label">Email Address</div>
            <div className="profile-value">{user.email}</div>
          </div>
          <div className="profile-item">
            <div className="profile-label">WhatsApp Number</div>
            <div className="profile-value">{user.whatsapp}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfirmModal({ serialName, onConfirm, onCancel }){
  return(
    <div className="modal-bg show">
      <div className="modal confirm-modal">
        <button className="modal-close" onClick={onCancel}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div className="modal-hdr">
          <div className="modal-icon warning">
            <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div className="modal-title">Remove Serial</div>
          <div className="modal-subtitle">Are you sure you want to remove "{serialName}" from your dashboard?</div>
        </div>
        <div className="confirm-actions">
          <button className="confirm-btn cancel" onClick={onCancel}>Cancel</button>
          <button className="confirm-btn delete" onClick={onConfirm}>Remove</button>
        </div>
      </div>
    </div>
  )
}

function Dashboard({ user }){
  const [searchQuery,setSearchQuery]=useState('')
  const [serials,setSerials]=useState([])
  const [showDownloadModal,setShowDownloadModal]=useState(false)
  const [showProcessingModal,setShowProcessingModal]=useState(false)
  const [showErrorModal,setShowErrorModal]=useState(false)
  const [showToast,setShowToast]=useState(false)
  const [showProfileModal,setShowProfileModal]=useState(false)
  const [showAddSerialModal,setShowAddSerialModal]=useState(false)
  const [showConfirmModal,setShowConfirmModal]=useState(false)
  const [currentSerial,setCurrentSerial]=useState(null)
  const [serialToRemove,setSerialToRemove]=useState(null)
  const [progress,setProgress]=useState(0)
  const [downloadType,setDownloadType]=useState('')
  const pollingRef=useRef(null)

  const loadSerials=()=>{
    fetch('/api/serials',{credentials:'include'})
      .then(r=>{
        if(r.status===401){
          window.location.href='/login?message=session-expired'
          return
        }
        return r.json()
      })
      .then(j=>{
        if(!j) return
        setSerials(j.serials||[])
      })
  }

  const stopPolling=()=>{
    if(pollingRef.current){
      clearInterval(pollingRef.current)
      pollingRef.current=null
    }
  }

  useEffect(()=>{loadSerials();return()=>stopPolling()},[])

  const filteredSerials=useMemo(()=>serials.filter(s=>s.name.toLowerCase().includes(searchQuery.toLowerCase())),[serials,searchQuery])
  const hasNoSerials=serials.length===0

  const closeAll=()=>{stopPolling();setShowDownloadModal(false);setShowProcessingModal(false);setShowErrorModal(false);setShowProfileModal(false);setShowAddSerialModal(false);setShowConfirmModal(false)}

  const handleDownload=async(type)=>{
    setShowDownloadModal(false);setShowProcessingModal(true);setDownloadType(type);setProgress(0)
    try{
      const r=await fetch('/api/download',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({serialId:currentSerial.id,type})})
      if(r.status===401){
        window.location.href='/login?message=session-expired'
        return
      }
      const d=await r.json()
      if(d.status==='ready'){
        stopPolling()
        window.location.href=d.downloadUrl
        setShowProcessingModal(false)
        setShowToast(true)
        setTimeout(()=>setShowToast(false),3000)
      }else if(d.status==='queued'||d.status==='processing'){
        pollStatus(currentSerial.id,type)
      }else{
        stopPolling()
        setShowProcessingModal(false)
        setShowErrorModal(true)
      }
    }catch(e){
      stopPolling()
      setShowProcessingModal(false)
      setShowErrorModal(true)
    }
  }

  const pollStatus=(serialId,type)=>{
    stopPolling()
    const id=setInterval(async()=>{
      try{
        const r=await fetch('/api/status/check?serialId='+encodeURIComponent(serialId)+'&type='+encodeURIComponent(type),{credentials:'include'})
        if(r.status===401){
          stopPolling()
          window.location.href='/login?message=session-expired'
          return
        }
        const d=await r.json()
        if(d.status==='processing') setProgress(d.progress||0)
        if(d.status==='ready'){
          stopPolling()
          window.location.href=d.downloadUrl
          setShowProcessingModal(false)
          setShowToast(true)
          setTimeout(()=>setShowToast(false),3000)
        }
        if(d.status==='error'){
          stopPolling()
          setShowProcessingModal(false)
          setShowErrorModal(true)
        }
      }catch(e){
        stopPolling()
        setShowProcessingModal(false)
        setShowErrorModal(true)
      }
    },3000)
    pollingRef.current=id
  }

  const handleSerialClick=serial=>{setCurrentSerial(serial);setShowDownloadModal(true)}

  const handleRemoveSerial=serial=>{
    setSerialToRemove(serial)
    setShowConfirmModal(true)
  }

  const confirmRemoveSerial=async()=>{
    if(!serialToRemove) return
    setShowConfirmModal(false)
    try{
      const r=await fetch(`/api/serials/remove/${serialToRemove.id}`,{method:'DELETE',credentials:'include'})
      if(r.status===401){
        window.location.href='/login?message=session-expired'
        return
      }
      const data=await r.json()
      if(data.success) loadSerials()
      else alert(data.error||'Failed to remove serial')
    }catch(e){alert('Network error: '+e.message)}
    setSerialToRemove(null)
  }

  const handleSerialAdded=()=>{loadSerials()}

  return(
    <div>
      <Header user={user} onProfileClick={()=>setShowProfileModal(true)} onAddSerial={()=>setShowAddSerialModal(true)} />
      {hasNoSerials?(
        <div className="empty-dashboard">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
              <polyline points="17 2 12 7 7 2"></polyline>
            </svg>
          </div>
          <div className="empty-title">Your Dashboard is Empty</div>
          <div className="empty-subtitle">Add serials to start downloading your favorite shows</div>
          <button className="empty-btn" onClick={()=>setShowAddSerialModal(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Your First Serial
          </button>
        </div>
      ):(
        <>
          <div className="search-bar">
            <div className="input">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="#6b7380" strokeWidth="1.6"/>
                <path d="M21 21l-4.35-4.35" stroke="#6b7380" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input placeholder="Search serials..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
            </div>
          </div>
          <main className="grid">
            {filteredSerials.map(s=><SerialCard key={s.id} serial={s} onClick={()=>handleSerialClick(s)} onRemove={handleRemoveSerial} />)}
          </main>
        </>
      )}
      {showDownloadModal&&<DownloadModal serial={currentSerial} onClose={closeAll} onDownload={handleDownload} />}
      {showProcessingModal&&<ProcessingModal type={downloadType} progress={progress} onClose={closeAll} />}
      {showErrorModal&&<ErrorModal onClose={closeAll} />}
      {showToast&&<Toast serialName={currentSerial?.name} />}
      {showProfileModal&&<ProfileModal user={user} onClose={closeAll} />}
      {showAddSerialModal&&<AddSerialModal onClose={closeAll} onAdd={handleSerialAdded} />}
      {showConfirmModal&&<ConfirmModal serialName={serialToRemove?.name} onConfirm={confirmRemoveSerial} onCancel={closeAll} />}
    </div>
  )
}

function Home({ status }){
  return(
    <div style={{fontFamily:'Inter, sans-serif',background:'linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%)',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
      <div style={{width:'100%',maxWidth:'440px'}}>
        <div style={{textAlign:'center',marginBottom:'32px'}}>
          <div style={{width:'64px',height:'64px',margin:'0 auto 16px',background:'linear-gradient(135deg, #8b5cf6, #6366f1)',borderRadius:'16px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',fontWeight:'800',color:'#fff',boxShadow:'0 20px 60px rgba(139, 92, 246, 0.3)'}}>TK</div>
          <div style={{fontSize:'26px',fontWeight:'700',marginBottom:'6px',color:'#1e293b'}}>TubeKit</div>
          <div style={{fontSize:'14px',color:'#64748b',fontWeight:'500'}}>{status==='pending'?'Your request is being reviewed':'Join our exclusive pre-launch'}</div>
          <div style={{display:'inline-block',padding:'6px 14px',background:'#fff',border:'1.5px solid #e0e7ff',borderRadius:'20px',fontSize:'12px',color:'#6366f1',fontWeight:'600',marginTop:'8px',boxShadow:'0 4px 12px rgba(99, 102, 241, 0.1)'}}>{status==='pending'?'⏳ Pending':'🔒 Invite Only'}</div>
        </div>
        <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'24px',padding:'32px',boxShadow:'0 25px 80px rgba(15, 23, 42, 0.08)'}}>
          {status==='pending'?<PendingScreen />:<InviteForm />}
        </div>
      </div>
    </div>
  )
}

function App(){
  const [status,setStatus]=useState('loading')
  const [user,setUser]=useState(null)
  useEffect(()=>{
    fetch('/api/auth/status',{credentials:'include'})
      .then(r=>{
        if(r.status===401){
          window.location.href='/login?message=session-expired'
          return
        }
        return r.json()
      })
      .then(j=>{
        if(!j) return
        setStatus(j.status||'guest')
        setUser(j.user||null)
      })
  },[])
  if(status==='loading') return <div className="container"></div>
  if(status==='pending') return <PendingScreen />
  if(status==='expired') return <ExpiredPlanModal />
  if(status==='guest') return <InviteForm />
  return <div className="container"><Dashboard user={user||{name:'',email:'',whatsapp:''}}/></div>
}

createRoot(document.getElementById('root')).render(<App />)

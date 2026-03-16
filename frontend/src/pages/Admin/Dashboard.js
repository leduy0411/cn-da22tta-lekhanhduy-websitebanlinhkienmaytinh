import React, { useState, useEffect } from 'react';
import {
  FiUsers, FiPackage, FiShoppingBag, FiDollarSign,
  FiAlertCircle, FiTrendingUp, FiEye, FiX,
  FiBarChart2, FiArrowUp, FiArrowDown,
  FiAward, FiRefreshCw, FiPlusCircle, FiMessageSquare
} from 'react-icons/fi';
import { adminAPI, orderAPI, productAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import Swal from 'sweetalert2';
import './Dashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/* ── Helpers ──────────────────────────────────────────────── */
const fmt = (n) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

const fmtShort = (n) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'T';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)         return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

const fmtDate = (d) =>
  new Date(d).toLocaleString('vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });

const STATUS_MAP = {
  pending:    { label: 'Chờ xử lý',  cls: 'db-badge-pending'    },
  processing: { label: 'Đang xử lý', cls: 'db-badge-processing' },
  shipped:    { label: 'Đang giao',  cls: 'db-badge-shipped'    },
  delivered:  { label: 'Đã giao',    cls: 'db-badge-delivered'  },
  cancelled:  { label: 'Đã hủy',     cls: 'db-badge-cancelled'  },
};

/* ── Custom Tooltip ───────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #ede9ff',
      borderRadius: 10, padding: '10px 14px',
      boxShadow: '0 4px 16px rgba(115,103,240,.15)',
      fontSize: '.82rem', color: '#3c3e64'
    }}>
      <p style={{ margin: 0, fontWeight: 700, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: 0, color: p.color }}>
          {p.name === 'revenue' ? fmt(p.value) : `${p.value} đơn`}
        </p>
      ))}
    </div>
  );
};

/* ── Dashboard Component ──────────────────────────────────── */
const Dashboard = () => {
  const [stats, setStats]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [modalData, setModalData]     = useState({ show: false, type: '', data: [], title: '' });
  const navigate  = useNavigate();
  const { isAdmin, user } = useAuth();

  /* fetch */
  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const promises = [productAPI.getAll({ stock_lte: 5, limit: 5 })];

      if (isAdmin()) {
        promises.unshift(adminAPI.getStats());
        promises.push(adminAPI.getAllOrders({ status: 'pending', limit: 5 }));
        promises.push(
          axios.get(`${API_URL}/admin/orders`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { limit: 500 }
          })
        );
      } else {
        promises.unshift(orderAPI.getOrders({ status: 'pending', limit: 5 }));
      }

      const results = await Promise.all(promises);

      if (isAdmin()) {
        const [statsRes, productsRes, ordersRes, allOrdersRes] = results;
        setStats(statsRes.data);
        setLowStockProducts(productsRes.data.products || productsRes.data || []);
        setPendingOrders(ordersRes.data.orders || []);
        buildRevenueData(allOrdersRes?.data?.orders || allOrdersRes?.data || []);
      } else {
        const [ordersRes, productsRes] = results;
        setPendingOrders(ordersRes.data || []);
        setLowStockProducts(productsRes.data.products || productsRes.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const buildRevenueData = (orders) => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        date: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        fullDate: d.toDateString(),
        revenue: 0,
        orders: 0
      });
    }
    orders.forEach(o => {
      if (o.status === 'cancelled') return;
      const day = days.find(d => d.fullDate === new Date(o.createdAt).toDateString());
      if (day) { day.revenue += o.totalAmount || 0; day.orders += 1; }
    });
    setRevenueData(days);
  };

  /* stat card click modal */
  const handleStatClick = async (type) => {
    try {
      const token = localStorage.getItem('token');
      let data = [], title = '';
      if (type === 'users') {
        title = 'Danh sách Khách hàng';
        const r = await axios.get(`${API_URL}/admin/users`, {
          headers: { Authorization: `Bearer ${token}` }, params: { limit: 100 }
        });
        data = r.data.users || [];
      } else if (type === 'products') {
        title = 'Danh sách Sản phẩm';
        const r = await productAPI.getAll({ limit: 100 });
        data = r.data.products || r.data || [];
      } else if (type === 'orders') {
        title = 'Danh sách Đơn hàng';
        const r = await axios.get(`${API_URL}/admin/orders`, {
          headers: { Authorization: `Bearer ${token}` }, params: { limit: 100 }
        });
        data = r.data.orders || r.data || [];
      } else if (type === 'revenue') {
        title = 'Chi tiết Doanh thu';
        const r = await axios.get(`${API_URL}/admin/orders`, {
          headers: { Authorization: `Bearer ${token}` }, params: { limit: 100 }
        });
        data = (r.data.orders || r.data || []).filter(o => o.status !== 'cancelled');
      }
      setModalData({ show: true, type, data, title });
    } catch {
      Swal.fire('Lỗi', 'Không thể tải dữ liệu!', 'error');
    }
  };

  /* ── Loading ── */
  if (loading) return (
    <div className="db-loading">
      <div className="db-loading-spinner" />
      <span style={{ fontWeight: 700, color: '#7367F0' }}>Đang tải dữ liệu...</span>
    </div>
  );

  /* ── Derived values ── */
  const weekRevTotal = revenueData.reduce((s, d) => s + d.revenue, 0);
  const weekOrdTotal = revenueData.reduce((s, d) => s + d.orders, 0);

  /* stat cards data */
  const miniStats = [
    { label: 'Khách hàng', value: fmtShort(stats?.totalUsers || 0),    icon: <FiUsers />,       color: 'purple', type: 'users'    },
    { label: 'Sản phẩm',   value: fmtShort(stats?.totalProducts || 0), icon: <FiPackage />,     color: 'orange', type: 'products' },
    { label: 'Đơn hàng',   value: fmtShort(stats?.totalOrders || 0),   icon: <FiShoppingBag />, color: 'blue',   type: 'orders'   },
    { label: 'Doanh thu',  value: fmtShort(stats?.totalRevenue || 0),  icon: <FiDollarSign />,  color: 'green',  type: 'revenue'  },
  ];

  return (
    <div className="materio-dashboard">

      {/* ── ROW 1: Congrats + Stats ── */}
      <div className="db-row db-row-2" style={{ gridTemplateColumns: '1fr 1.6fr' }}>

        {/* Congrats card */}
        <div className="db-card db-congrats-card">
          <div className="db-congrats-body">
            <p className="db-congrats-greeting">Xin chào, {user?.name || 'Admin'}! 🎉</p>
            <p className="db-congrats-sub">Doanh thu hôm nay</p>
            <p className="db-congrats-amount">
              {fmt(revenueData[revenueData.length - 1]?.revenue || 0)}
            </p>
            <a href="/admin/orders" className="db-congrats-btn">
              <FiBarChart2 /> Xem báo cáo
            </a>
          </div>
          <div className="db-congrats-trophy">🏆</div>
        </div>

        {/* Statistics card */}
        {isAdmin() && (
          <div className="db-card db-stats-card">
            <div className="db-stats-header-row">
              <div>
                <p className="db-card-title" style={{ marginBottom: 2 }}>Thống kê tổng quan</p>
                <p className="db-stats-growth">
                  Tăng trưởng hệ thống &nbsp;<strong>↑ Hôm nay</strong>
                </p>
              </div>
            </div>
            <div className="db-stats-grid">
              {miniStats.map((s) => (
                <div
                  key={s.type}
                  className="db-mini-stat"
                  onClick={() => handleStatClick(s.type)}
                  title={`Xem chi tiết ${s.label}`}
                >
                  <div className={`db-mini-stat-icon ${s.color}`}>{s.icon}</div>
                  <span className="db-mini-stat-label">{s.label}</span>
                  <span className="db-mini-stat-value">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Alerts (if admin) ── */}
      {isAdmin() && (
        <div className="db-alert-row">
          <div className="db-alert-card danger">
            <div className="db-alert-icon danger"><FiAlertCircle /></div>
            <div className="db-alert-content">
              <h4>Đơn hàng chờ xử lý</h4>
              <p className="db-alert-val danger">{stats?.pendingOrders || 0}</p>
            </div>
          </div>
          <div className="db-alert-card warning">
            <div className="db-alert-icon warning"><FiTrendingUp /></div>
            <div className="db-alert-content">
              <h4>Sản phẩm sắp hết hàng</h4>
              <p className="db-alert-val warning">{stats?.lowStockProducts || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── ROW 2: Weekly Overview + Earning + 2 Metric ── */}
      {isAdmin() && (
        <div className="db-row" style={{ gridTemplateColumns: '1.6fr 1fr .7fr .7fr' }}>

          {/* Weekly Overview */}
          <div className="db-card db-weekly-card">
            <p className="db-card-title">📊 Doanh thu 7 ngày</p>
            <p className="db-card-subtitle">Tổng: {fmt(weekRevTotal)}</p>
            <div className="db-chart-wrap">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f8" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8a8dac' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#8a8dac' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1_000_000 ? `${(v/1_000_000).toFixed(0)}M` : v}
                    width={38}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '.78rem' }} />
                  <Bar dataKey="revenue" name="Doanh thu" fill="url(#barGrad)" radius={[6,6,0,0]} maxBarSize={32} />
                  <Bar dataKey="orders"  name="Đơn hàng"  fill="url(#barGrad2)" radius={[6,6,0,0]} maxBarSize={32} />
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7367F0" />
                      <stop offset="100%" stopColor="#9f8bff" stopOpacity={.7} />
                    </linearGradient>
                    <linearGradient id="barGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#28C76F" />
                      <stop offset="100%" stopColor="#48da89" stopOpacity={.7} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="db-weekly-perf">
              Tổng tuần này: &nbsp;<strong>{weekOrdTotal} đơn</strong>
            </p>
          </div>

          {/* Total Earning */}
          <div className="db-card db-earning-card">
            <p className="db-card-title">💰 Tổng doanh thu</p>
            <div className="db-earning-amount">
              {fmtShort(stats?.totalRevenue || 0)}
              <span className="db-earning-up"><FiArrowUp /> 10%</span>
            </div>
            <p className="db-earning-compare">So với tháng trước</p>
            <div className="db-earning-list">
              {[
                { icon: '🟣', name: 'Đơn đã giao', sub: 'Hoàn thành', color: '#7367F0', pct: 60 },
                { icon: '🟡', name: 'Đang xử lý',  sub: 'Tiến hành',  color: '#FF9F43', pct: 25 },
                { icon: '🔵', name: 'Đang giao',   sub: 'Vận chuyển', color: '#00CFE8', pct: 15 },
              ].map((item, i) => (
                <div key={i} className="db-earning-item">
                  <div className="db-earning-item-icon" style={{ background: item.color + '18' }}>
                    <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                  </div>
                  <div className="db-earning-item-info">
                    <p className="db-earning-item-name">{item.name}</p>
                    <p className="db-earning-item-sub">{item.sub}</p>
                    <div className="db-earning-item-bar" style={{
                      width: '100%', background: '#f0f1f8'
                    }}>
                      <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Profit */}
          <div className="db-card db-metric-card">
            <div>
              <div className="db-metric-icon-wrap" style={{ background: 'rgba(40,199,111,.12)', color: '#28C76F' }}>
                <FiTrendingUp />
              </div>
              <p className="db-metric-label">Lợi nhuận</p>
              <p className="db-metric-val">{fmtShort((stats?.totalRevenue || 0) * 0.25)}</p>
              <span className="db-metric-change up"><FiArrowUp /> +42%</span>
              <span className="db-metric-period">Tuần này</span>
            </div>
          </div>

          {/* Refunds */}
          <div className="db-card db-metric-card">
            <div>
              <div className="db-metric-icon-wrap" style={{ background: 'rgba(234,84,85,.12)', color: '#EA5455' }}>
                <FiRefreshCw />
              </div>
              <p className="db-metric-label">Hoàn tiền</p>
              <p className="db-metric-val">{stats?.pendingOrders || 0}</p>
              <span className="db-metric-change down"><FiArrowDown /> -15%</span>
              <span className="db-metric-period">Tháng trước</span>
            </div>
          </div>
        </div>
      )}

      {/* ── ROW 3: New Project + Sales Queries + Quick Actions ── */}
      {isAdmin() && (
        <div className="db-row db-row-3">
          <div className="db-card db-metric-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <div className="db-metric-icon-wrap" style={{ background: 'rgba(0,207,232,.12)', color: '#00CFE8', marginBottom: 0, width: 52, height: 52, flexShrink: 0 }}>
              <FiPlusCircle size={22} />
            </div>
            <div>
              <p className="db-metric-label" style={{ margin: 0 }}>Dự án mới</p>
              <p className="db-metric-val" style={{ margin: '2px 0' }}>{stats?.totalProducts || 0}</p>
              <span className="db-metric-change down"><FiArrowDown /> -18%</span>
              <span className="db-metric-period">Yearly Project</span>
            </div>
          </div>
          <div className="db-card db-metric-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <div className="db-metric-icon-wrap" style={{ background: 'rgba(255,159,67,.12)', color: '#FF9F43', marginBottom: 0, width: 52, height: 52, flexShrink: 0 }}>
              <FiMessageSquare size={22} />
            </div>
            <div>
              <p className="db-metric-label" style={{ margin: 0 }}>Câu hỏi</p>
              <p className="db-metric-val" style={{ margin: '2px 0' }}>15</p>
              <span className="db-metric-change down"><FiArrowDown /> -18%</span>
              <span className="db-metric-period">Last Week</span>
            </div>
          </div>
          <div className="db-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p className="db-card-title" style={{ marginBottom: 14 }}>🚀 Thao tác nhanh</p>
            <div className="db-quick-row" style={{ gridTemplateColumns: '1fr' }}>
              <a href="/admin/products" className="db-quick-btn"><FiPackage /> Sản phẩm</a>
              <a href="/admin/orders"   className="db-quick-btn"><FiShoppingBag /> Đơn hàng</a>
              <a href="/admin/users"    className="db-quick-btn"><FiUsers /> Người dùng</a>
            </div>
          </div>
        </div>
      )}

      {/* ── Tables ── */}
      <div className="db-row db-row-2">
        {/* Pending Orders */}
        <div className="db-card db-table-card">
          <div className="db-section-header">
            <p className="db-card-title">🛒 Đơn hàng chờ xử lý</p>
            <a href="/admin/orders" className="db-view-all">Xem tất cả →</a>
          </div>
          {pendingOrders.length === 0 ? (
            <p className="db-no-data">Không có đơn hàng chờ xử lý</p>
          ) : (
            <table className="db-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map(o => (
                  <tr key={o._id}>
                    <td><span className="db-order-code">#{o.orderNumber}</span></td>
                    <td>{o.customerInfo?.name}</td>
                    <td style={{ color: '#7367F0', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(o.totalAmount)}</td>
                    <td>
                      <span className={`db-badge ${STATUS_MAP[o.status]?.cls || ''}`}>
                        {STATUS_MAP[o.status]?.label || o.status}
                      </span>
                    </td>
                    <td>
                      <button className="db-btn-action" onClick={() => navigate('/admin/orders')} title="Xem"><FiEye /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Low Stock */}
        <div className="db-card db-table-card">
          <div className="db-section-header">
            <p className="db-card-title">📦 Sản phẩm sắp hết hàng</p>
            <a href="/admin/products" className="db-view-all">Xem tất cả →</a>
          </div>
          {lowStockProducts.length === 0 ? (
            <p className="db-no-data">Tất cả sản phẩm đều còn hàng</p>
          ) : (
            <table className="db-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Danh mục</th>
                  <th>Giá</th>
                  <th>Kho</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map(p => (
                  <tr key={p._id}>
                    <td>
                      <div className="db-product-row">
                        <img
                          className="db-product-img"
                          src={p.image?.startsWith('http') ? p.image : `${API_URL}${p.image}`}
                          alt={p.name}
                          onError={e => e.target.src = 'https://via.placeholder.com/42'}
                        />
                        <span className="db-product-name">{p.name}</span>
                      </div>
                    </td>
                    <td style={{ color: '#8a8dac' }}>{p.category}</td>
                    <td style={{ color: '#7367F0', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(p.price)}</td>
                    <td>
                      <span className={`db-stock-badge ${p.stock <= 2 ? 'critical' : 'low'}`}>
                        {p.stock} sp
                      </span>
                    </td>
                    <td>
                      <button className="db-btn-action" onClick={() => navigate('/admin/products')} title="Cập nhật"><FiEye /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Employee: fallback view */}
      {!isAdmin() && (
        <div className="db-card" style={{ padding: '28px 24px' }}>
          <p style={{ margin: 0, color: '#3c3e64', fontSize: '1.1rem', fontWeight: 700 }}>
            Xin chào, {user?.name || 'Nhân viên'}! 👋
          </p>
          <p style={{ color: '#8a8dac', marginTop: 8, marginBottom: 0 }}>
            Dưới đây là danh sách đơn hàng cần xử lý.
          </p>
        </div>
      )}

      {/* ── Modal ── */}
      {modalData.show && (
        <div className="db-modal-overlay" onClick={() => setModalData({ show: false, type: '', data: [], title: '' })}>
          <div className="db-modal" onClick={e => e.stopPropagation()}>
            <div className="db-modal-head">
              <h3>{modalData.title}</h3>
              <button className="db-modal-close" onClick={() => setModalData({ show: false, type: '', data: [], title: '' })}>
                <FiX />
              </button>
            </div>
            <div className="db-modal-body">
              {/* Users */}
              {modalData.type === 'users' && (
                <table className="db-table">
                  <thead><tr><th>Tên</th><th>Email</th><th>Quyền</th><th>Ngày đăng ký</th></tr></thead>
                  <tbody>
                    {modalData.data.length === 0 ? (
                      <tr><td colSpan={4}><p className="db-no-data">Không có dữ liệu</p></td></tr>
                    ) : modalData.data.map(u => (
                      <tr key={u._id}>
                        <td style={{ fontWeight: 700 }}>{u.name}</td>
                        <td>{u.email}</td>
                        <td><span className={`db-role-badge ${u.role}`}>{u.role === 'admin' ? 'Admin' : u.role === 'staff' ? 'Nhân viên' : 'Khách hàng'}</span></td>
                        <td style={{ color: '#8a8dac', fontSize: '.82rem' }}>{fmtDate(u.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Products */}
              {modalData.type === 'products' && (
                <table className="db-table">
                  <thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Giá</th><th>Tồn kho</th></tr></thead>
                  <tbody>
                    {modalData.data.length === 0 ? (
                      <tr><td colSpan={4}><p className="db-no-data">Không có dữ liệu</p></td></tr>
                    ) : modalData.data.map(p => (
                      <tr key={p._id}>
                        <td>
                          <div className="db-product-row">
                            <img className="db-product-img" src={p.image?.startsWith('http') ? p.image : `${API_URL}${p.image}`} alt={p.name} onError={e => e.target.src='https://via.placeholder.com/42'} />
                            <span className="db-product-name">{p.name}</span>
                          </div>
                        </td>
                        <td style={{ color: '#8a8dac' }}>{p.category}</td>
                        <td style={{ color: '#7367F0', fontWeight: 700 }}>{fmt(p.price)}</td>
                        <td style={{ textAlign: 'center' }}>{p.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Orders & Revenue */}
              {(modalData.type === 'orders' || modalData.type === 'revenue') && (
                <table className="db-table">
                  <thead>
                    <tr>
                      <th>Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th><th>Tổng tiền</th><th>Trạng thái</th><th>Ngày đặt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.data.length === 0 ? (
                      <tr><td colSpan={6}><p className="db-no-data">Không có dữ liệu</p></td></tr>
                    ) : modalData.data.map(o => (
                      <tr key={o._id}>
                        <td><span className="db-order-code">#{o.orderNumber}</span></td>
                        <td>{o.customerInfo?.name}</td>
                        <td>
                          <div style={{ fontSize: '.8rem', color: '#8a8dac' }}>
                            {o.items?.slice(0,2).map((it,i) => <div key={i}>• {it.name} (x{it.quantity})</div>)}
                            {o.items?.length > 2 && <div>+{o.items.length-2} SP khác</div>}
                          </div>
                        </td>
                        <td style={{ color: '#7367F0', fontWeight: 700 }}>{fmt(o.totalAmount)}</td>
                        <td>
                          <span className={`db-badge ${STATUS_MAP[o.status]?.cls || ''}`}>
                            {STATUS_MAP[o.status]?.label || o.status}
                          </span>
                        </td>
                        <td style={{ color: '#8a8dac', fontSize: '.8rem' }}>{fmtDate(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

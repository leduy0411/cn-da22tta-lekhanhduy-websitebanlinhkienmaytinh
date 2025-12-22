import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { orderAPI, zalopayAPI } from '../services/api';
import './OrderSuccess.css';

const ZaloPayCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('checking'); // checking, success, failed
  const [message, setMessage] = useState('Đang xác nhận thanh toán...');

  useEffect(() => {
    const checkPayment = async () => {
      try {
        const orderId = localStorage.getItem('pendingOrderId');
        const orderNumber = localStorage.getItem('pendingOrderNumber');

        if (!orderId) {
          setStatus('failed');
          setMessage('Không tìm thấy thông tin đơn hàng');
          return;
        }

        // GIẢ LẬP THANH TOÁN THÀNH CÔNG - Sandbox mode
        // Trong môi trường sandbox, luôn coi như thanh toán thành công
        setStatus('success');
        setMessage('🎉 Thanh toán thành công!');
        
        // Cập nhật trạng thái đơn hàng thành đã thanh toán
        try {
          await orderAPI.updateOrderStatus(orderId, 'Processing');
        } catch (err) {
          console.log('Could not update order status:', err);
        }
        
        // Xóa pending order
        localStorage.removeItem('pendingOrderId');
        localStorage.removeItem('pendingOrderNumber');
        
        // Chuyển đến trang order success sau 2 giây
        setTimeout(() => {
          navigate(`/order-success/${orderId}`);
        }, 2000);

      } catch (error) {
        console.error('Error checking payment:', error);
        // Vẫn coi như thành công trong sandbox
        const orderId = localStorage.getItem('pendingOrderId');
        if (orderId) {
          setStatus('success');
          setMessage('🎉 Thanh toán thành công!');
          localStorage.removeItem('pendingOrderId');
          localStorage.removeItem('pendingOrderNumber');
          setTimeout(() => {
            navigate(`/order-success/${orderId}`);
          }, 2000);
        } else {
          setStatus('failed');
          setMessage('Lỗi khi xác nhận thanh toán');
        }
      }
    };

    checkPayment();
  }, [searchParams, navigate]);

  return (
    <div className="order-success-page">
      <div className="container">
        <div className="success-card">
          {status === 'checking' && (
            <>
              <div className="spinner-large"></div>
              <h2>{message}</h2>
              <p>Vui lòng đợi trong giây lát...</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="success-icon-large">✅</div>
              <h2>{message}</h2>
              <p>Đang chuyển đến trang xác nhận đơn hàng...</p>
            </>
          )}
          
          {status === 'failed' && (
            <>
              <div className="error-icon-large">❌</div>
              <h2>{message}</h2>
              <p>Bạn sẽ được chuyển về trang thanh toán...</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ZaloPayCallback;

export default function EditProductModal({
  editItem,
  setEditItem,
  saveEdit,
}: any) {
  if (!editItem) return null;

  return (
    <div className="modal">
      <div className="box">
        <h2>Edit Product</h2>

        <button onClick={() => saveEdit(editItem)}>Save</button>
        <button onClick={() => setEditItem(null)}>Cancel</button>
      </div>

      <style jsx>{`
        .modal {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .box {
          background: #0f172a;
          padding: 20px;
          border-radius: 12px;
          width: 350px;
          color: white;
        }
      `}</style>
    </div>
  );
}
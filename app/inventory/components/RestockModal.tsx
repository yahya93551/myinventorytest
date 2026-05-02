export default function RestockModal({
  restockItem,
  restockAmount,
  setRestockAmount,
  setRestockItem,
  saveRestock,
}: any) {
  if (!restockItem) return null;

  return (
    <div className="modal">
      <div className="box">
        <h2>Restock {restockItem.name}</h2>

        <input
          className="input"
          type="number"
          value={restockAmount}
          onChange={e => setRestockAmount(Number(e.target.value))}
        />

        <div className="row">
          <button onClick={() => setRestockItem(null)}>Cancel</button>
          <button onClick={saveRestock}>Restock</button>
        </div>
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
        .input {
          width: 100%;
          padding: 10px;
          margin-top: 10px;
          border-radius: 8px;
          background: rgba(255,255,255,0.1);
        }
        .row {
          display: flex;
          justify-content: space-between;
          margin-top: 15px;
        }
      `}</style>
    </div>
  );
}
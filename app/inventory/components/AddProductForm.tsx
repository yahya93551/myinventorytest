export default function AddProductForm({
  name,
  setName,
  category,
  setCategory,
  price,
  setPrice,
  stock,
  setStock,
  categories,
  addProductHandler,
}: any) {
  return (
    <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-6">

      <h3 className="text-xl font-semibold mb-4 text-white">
        ➕ Add New Product
      </h3>

      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* NAME */}
        <div>
          <label className="text-sm text-gray-300">Product Name</label>
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Laptop"
          />
        </div>

        {/* CATEGORY */}
        <div>
          <label className="text-sm text-gray-300">Category</label>
          <select
            className="input text-white bg-slate-800"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {categories.map((c: string) => (
              <option key={c} className="text-black">
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* PRICE */}
        <div>
          <label className="text-sm text-gray-300">Price ($)</label>
          <input
            className="input"
            type="number"
            value={price}
            onChange={e => setPrice(Number(e.target.value))}
            placeholder="0.00"
          />
        </div>

        {/* STOCK */}
        <div>
          <label className="text-sm text-gray-300">Stock Qty</label>
          <input
            className="input"
            type="number"
            value={stock}
            onChange={e => setStock(Number(e.target.value))}
            placeholder="0"
          />
        </div>
      </div>

      {/* BUTTON */}
      <div className="mt-5 flex justify-end">
        <button onClick={addProductHandler} className="btn">
          + Add Product
        </button>
      </div>

      {/* STYLES */}
      <style jsx>{`
        .input {
          width: 100%;
          margin-top: 6px;
          padding: 12px;
          border-radius: 12px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          outline: none;
        }

        .input:focus {
          border-color: #6366f1;
          background: rgba(255,255,255,0.1);
        }

        .btn {
          padding: 10px 18px;
          border-radius: 12px;
          font-weight: 600;
          color: white;
          background: linear-gradient(to right, #7c3aed, #4f46e5);
        }
      `}</style>
    </div>
  );
}
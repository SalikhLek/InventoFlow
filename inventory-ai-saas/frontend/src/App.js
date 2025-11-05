import React, { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

const LOW_STOCK_THRESHOLD = 5;

const darkTheme = {
  background: "#17191f",
  card: "#232536",
  text: "#ffffff",
  softText: "#b0b4c3",
  border: "#383b4e",
  accent: "#007bff",
  warningBg: "#462c0a",
  warningText: "#ffe082",
  tableHeader: "#23293b",
};

function App() {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [alertItems, setAlertItems] = useState([]);
  const [orderStatus, setOrderStatus] = useState({}); // {itemId: "ordered"}

  useEffect(() => {
    axios
      .get("/items/")
      .then((res) => {
        setItems(res.data);
        const lows = res.data.filter((item) => item.quantity <= LOW_STOCK_THRESHOLD);
        setAlertItems(lows);
        if (res.data.length > 0) setSelectedItem(res.data[0]);
      })
      .catch(() => {
        setItems([]);
        setAlertItems([]);
        setSelectedItem(null);
      });
  }, []);

  useEffect(() => {
    if (selectedItem) {
      axios
        .get(`/items/${selectedItem.id}/forecast`)
        .then((res) => {
          if (res.data && res.data.forecast) {
            setForecast(
              res.data.forecast.map((qty, idx) => ({
                day: `День ${idx + 1}`,
                qty,
              }))
            );
          } else {
            setForecast([]);
          }
        })
        .catch(() => setForecast([]));
    } else {
      setForecast([]);
    }
  }, [selectedItem]);

  const handleOrder = (itemId) => {
    // Имитация отправки заказа (реального API нет, просто показываем статус)
    setOrderStatus((s) => ({ ...s, [itemId]: "ordered" }));
    setTimeout(() => setOrderStatus((s) => ({ ...s, [itemId]: undefined })), 2500);
  };

  // Dark theme root
  return (
    <div
      className="App"
      style={{
        background: darkTheme.background,
        minHeight: "100vh",
        color: darkTheme.text,
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ color: darkTheme.text, textAlign: "center", marginBottom: 10 }}>
        📦 Инвентарный AI Дашборд
      </h1>

      {/* Low stock warning */}
      {alertItems.length > 0 && (
        <div
          style={{
            background: darkTheme.warningBg,
            color: darkTheme.warningText,
            padding: "12px 22px",
            borderRadius: 6,
            marginBottom: 26,
            border: `1px solid ${darkTheme.warningText}`,
            maxWidth: 700,
            marginLeft: "auto",
            marginRight: "auto",
            fontWeight: 500,
            letterSpacing: 0.3,
          }}
        >
          <strong>Внимание!</strong> Дефицит по:&nbsp;
          <ul style={{ marginBottom: 0, display: "inline-block", marginLeft: 8 }}>
            {alertItems.map((item) => (
              <li key={item.id} style={{ margin:"2px 0" }}>
                {item.name} (кол-во: {item.quantity}){" "}
                <button
                  onClick={() => handleOrder(item.id)}
                  disabled={orderStatus[item.id] === "ordered"}
                  style={{
                    marginLeft: 10,
                    background: darkTheme.accent,
                    color: "#fff",
                    border: "none",
                    borderRadius: 3,
                    padding: "2px 16px",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px #0003",
                    fontSize: 15,
                  }}
                >
                  {orderStatus[item.id] === "ordered"
                    ? "Заказано!"
                    : "Заказать"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 40,
          alignItems: "flex-start",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {/* ТАБЛИЦА */}
        <div
          style={{
            background: darkTheme.card,
            padding: 24,
            borderRadius: 10,
            minWidth: 350,
            boxShadow: "0 4px 18px #10121c77",
            border: `1px solid ${darkTheme.border}`,
          }}
        >
          <h2 style={{ color: darkTheme.text, marginBottom: 12 }}>Товары</h2>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              marginBottom: 6,
              background: "none",
              color: darkTheme.text,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    background: darkTheme.tableHeader,
                    borderBottom: `2px solid ${darkTheme.border}`,
                    padding: 8,
                    textAlign: "left",
                    color: darkTheme.softText,
                  }}
                >
                  Название
                </th>
                <th
                  style={{
                    background: darkTheme.tableHeader,
                    borderBottom: `2px solid ${darkTheme.border}`,
                    padding: 8,
                    color: darkTheme.softText,
                  }}
                >
                  Кол-во
                </th>
                <th
                  style={{
                    background: darkTheme.tableHeader,
                    borderBottom: `2px solid ${darkTheme.border}`,
                    padding: 8,
                    color: darkTheme.softText,
                  }}
                >
                  Цена
                </th>
                <th
                  style={{
                    background: darkTheme.tableHeader,
                    borderBottom: `2px solid ${darkTheme.border}`,
                    padding: 8,
                    color: darkTheme.softText,
                  }}
                >
                  Действие
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isLow = item.quantity <= LOW_STOCK_THRESHOLD;
                const selected = selectedItem && selectedItem.id === item.id;
                return (
                  <tr
                    key={item.id}
                    style={{
                      background: selected ? "#232b4d" : "none",
                    }}
                  >
                    <td style={{ padding: 8, borderBottom: `1px solid ${darkTheme.border}` }}>
                      {item.name}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: `1px solid ${darkTheme.border}`,
                        color: isLow ? "#ffc957" : darkTheme.text,
                        fontWeight: isLow ? 700 : 400,
                      }}
                    >
                      {item.quantity}
                    </td>
                    <td style={{ padding: 8, borderBottom: `1px solid ${darkTheme.border}` }}>
                      {item.price.toFixed(2)}
                    </td>
                    <td style={{ padding: 8, borderBottom: `1px solid ${darkTheme.border}` }}>
                      <button
                        onClick={() => setSelectedItem(item)}
                        style={{
                          padding: "2px 14px",
                          background: selected
                            ? darkTheme.accent
                            : darkTheme.tableHeader,
                          color: "#fff",
                          border: "none",
                          borderRadius: 5,
                          cursor: "pointer",
                          fontWeight: selected ? 700 : 400,
                          fontSize: 15,
                          boxShadow: selected ? "0 2px 7px #2187ff4c" : undefined,
                        }}
                      >
                        {selected ? "Выбрано" : "Выбрать"}
                      </button>
                      {isLow && (
                        <button
                          onClick={() => handleOrder(item.id)}
                          disabled={orderStatus[item.id] === "ordered"}
                          style={{
                            marginLeft: 10,
                            background: darkTheme.accent,
                            color: "#fff",
                            border: "none",
                            borderRadius: 3,
                            padding: "1px 13px",
                            cursor: "pointer",
                            boxShadow: "0 2px 6px #0003",
                            fontSize: 14,
                          }}
                        >
                          {orderStatus[item.id] === "ordered"
                            ? "Заказано!"
                            : "Заказать"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: "center",
                      padding: 18,
                      color: darkTheme.softText,
                    }}
                  >
                    Нет товаров
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ГРАФИК */}
        <div
          style={{
            background: darkTheme.card,
            borderRadius: 10,
            padding: 24,
            minWidth: 380,
            border: `1px solid ${darkTheme.border}`,
            boxShadow: "0 4px 18px #10121c5b",
          }}
        >
          <h2 style={{ color: darkTheme.text, marginBottom: 10 }}>
            Прогноз спроса{selectedItem ? ` — ${selectedItem.name}` : ""}
          </h2>
          {forecast.length === 0 ? (
            <div
              style={{
                color: darkTheme.softText,
                padding: "40px 0",
                textAlign: "center",
                border: `1px solid ${darkTheme.border}`,
                borderRadius: 8,
                minWidth: 320,
                background: "#202335",
              }}
            >
              Недостаточно данных для прогноза <br /> (или выберите товар)
            </div>
          ) : (
            <ResponsiveContainer width={430} height={235}>
              <LineChart
                data={forecast}
                margin={{ top: 14, right: 19, left: 0, bottom: 8 }}
              >
                <CartesianGrid stroke="#24273b" strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  stroke={darkTheme.softText}
                  style={{ fontWeight: 500 }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke={darkTheme.softText}
                  style={{ fontWeight: 500 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#232b4d",
                    color: darkTheme.text,
                    border: "1px solid #44495d",
                    borderRadius: 7,
                  }}
                  itemStyle={{ fontWeight: 500 }}
                  labelStyle={{ color: darkTheme.accent, fontWeight: 600 }}
                />
                <Legend
                  wrapperStyle={{
                    color: darkTheme.softText,
                    fontWeight: 600,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="qty"
                  stroke={darkTheme.accent}
                  strokeWidth={3}
                  dot={{ r: 4, fill: darkTheme.accent }}
                  name="Спрос"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div style={{ marginTop: 48, textAlign: "center", color: "#666b90" }}>
        <span style={{ fontSize: 12, letterSpacing: 1 }}>
          Inventory AI SaaS • 2024
        </span>
      </div>
    </div>
  );
}

export default App;

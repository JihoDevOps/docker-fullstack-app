import React, { useState, useEffect } from "react";
import axios from "axios";
import logo from './logo.svg';
import './App.css';

function App() {

  const [list, setList] = useState([]);
  const [value, setValue] = useState("");

  useEffect(() => {
    axios.get("/api/values")
      .then(response => {
        console.log(response);
        setList(response.data);
      })
      .catch(err => console.log(err));
  }, []);

  const changeHandler = (event) => {
    setValue(event.currentTarget.value);
  };

  const submitHandler = (event) => {
    event.preventDefault();
    axios.post("/api/value", {value: value})
      .then(response => {
        if (response.data.success) {
          console.log(response);
          setList([...list, response.data]);
          setValue("");
        } else {
          alert("데이터 DB 저장을 실패했습니다.")
        }
      })
      .catch(err => console.log(err));
  };

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <div className="container">
          { list && list.map((tuple, index) => (
            <li key={ index }>{ tuple.value }</li>
          ))}
          <br />
          <form className="example" onSubmit={ submitHandler }>
            <input
              type="text"
              placeholder="입력해주세요..."
              onChange={ changeHandler }
              value={ value }
            />
            <button type="submit">확인</button>
          </form>
        </div>
      </header>
    </div>
  );
}

export default App;

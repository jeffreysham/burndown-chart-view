import React from "react";
import "./App.css";
import mondaySdk from "monday-sdk-js";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const monday = mondaySdk();

class CustomTooltip extends React.Component {
  render() {
    const { active } = this.props;

    if (active) {
      const { payload, label } = this.props;

      return (
        <div className="custom-tooltip">
          <p>{label}</p>
          <p>{payload ? ('Item Name: ' + payload[0].payload.itemName) : undefined}</p>
          <p>{payload ? ('Item Status: ' + payload[0].payload.itemStatus) : undefined}</p>
        </div>
      );
    }

    return null;
  }
};

class App extends React.Component {
  constructor(props) {
    super(props);

    // Default state
    this.state = {
      settings: {
        stroke: "#82ca9d",
        strokeWidth: "1",
        statusColumn: {"status": true},
        completionStatuses: "Done",
        itemWeightColumn: null,
        startDate: "",
        endDate: ""
      },
      graphData: [],
      boardIds: [],
      itemIds: [],
    };
  };

  componentDidMount() {
    monday.listen("settings", res => {
      this.setState({ settings: res.data });
      this.fetchItems(this.state.boardIds, this.state.itemIds);
    });
    monday.listen("context", contextResult => {
      this.setState({ boardIds: contextResult.data.boardIds });
      this.fetchItems(contextResult.data.boardIds, []);
    });
    monday.listen("itemIds", res => {
      this.setState({ itemIds: res.data });
      this.fetchItems(this.state.boardIds, res.data);
    });
  };

  async fetchItems(boardIds, selectedItemIds) {
    const weightColumnName = this.state.settings.itemWeightColumn ?
      Object.keys(this.state.settings.itemWeightColumn):
      [];

    // Get relevant item ids
    const response = await this.getItems(
      boardIds,
      selectedItemIds,
      weightColumnName);
    var itemIds = new Set();
    var itemIdToItemName = {};
    var itemIdToItemWeight = {};
    if (response.data.boards[0].items.length > 0) {
      var items = response.data.boards[0].items;
      for (var i = 0; i < items.length; i++) {
        const itemId = parseInt(items[i].id);
        itemIds.add(itemId);
        itemIdToItemName[itemId] = items[i].name;
        if (items[i].column_values) {
          itemIdToItemWeight[itemId] = Number(items[i].column_values[0].text);
        } else {
          itemIdToItemWeight[itemId] = 1;
        }
      }
    }

    var itemIdsArray = Array.from(itemIds);
    var finishedFetchingLogs = false;
    var pageNum = 1;
    var activityLogData = [];

    // Paginate through activity logs
    while (!finishedFetchingLogs) {
      const logResponse = await this.fetchActivityLogs(itemIdsArray, boardIds, pageNum);
      pageNum++;
      if (logResponse.data.boards[0].activity_logs.length > 0) {
        activityLogData = activityLogData.concat(logResponse.data.boards[0].activity_logs);
      } else {
        finishedFetchingLogs = true;
      }
    }

    // Build graph data
    var count = 0;
    var graphData = [];
    var completionStatusesSet = new Set(this.state.settings.completionStatuses.split(","));
    const statusColumnValue = this.state.settings.statusColumn ?
      Object.keys(this.state.settings.statusColumn)[0] :
      'status';
    const startDateValue = this.state.settings.startDate === '' ?
      null :
      new Date(this.state.settings.startDate);
    const endDateValue = this.state.settings.endDate === '' ?
      null :
      new Date(this.state.settings.endDate);

    for (var index = activityLogData.length - 1; index >= 0; index--) {
      const log = activityLogData[index];
      const logDateValue = new Date(log.created_at / 10000);
      const dateString = this.getDateString(logDateValue);
      const logData = JSON.parse(log.data);

      if (log.event === 'create_pulse') {
        const pulseId = logData.pulse_id;
        count += itemIdToItemWeight[pulseId];
        if ((startDateValue === null || endDateValue === null) ||
            (startDateValue <= logDateValue && logDateValue <= endDateValue))
        {
          graphData.push({
            'time': dateString,
            'value': count,
            'itemName': itemIdToItemName[pulseId],
            'itemStatus': 'Create'
          });
        }
      } else if (log.event === 'update_column_value' &&
          logData.column_id === statusColumnValue)
      {
        const pulseId = logData.pulse_id;

        // Check if status is done
        if (completionStatusesSet.has(logData.value.label.text)) {
          if (count > 0) {
            count -= itemIdToItemWeight[pulseId];
          }

          if ((startDateValue === null || endDateValue === null) ||
              (startDateValue <= logDateValue && logDateValue <= endDateValue))
          {
            graphData.push({
              'time': dateString,
              'value': count,
              'itemName': itemIdToItemName[pulseId],
              'itemStatus': logData.value.label.text
            });
          }
        } else if (logData.previous_value != null &&
            completionStatusesSet.has(logData.previous_value.label.text))
        {
          if (!completionStatusesSet.has(logData.value.label.text)) {
            count += itemIdToItemWeight[pulseId];
          }

          if ((startDateValue === null || endDateValue === null) ||
              (startDateValue <= logDateValue && logDateValue <= endDateValue))
          {
            graphData.push({
              'time': dateString,
              'value': count,
              'itemName': itemIdToItemName[pulseId],
              'itemStatus': logData.value.label.text
            });
          }
        }
      }
    }

    // Graph the data
    this.setState({graphData: graphData});
  }

  async fetchActivityLogs(itemIds, boardIds, pageNum) {
    const response = await monday.api(`query ($boardIds: [Int], $itemIds: [Int], $pageNum: Int) { boards (ids:$boardIds) { activity_logs(page: $pageNum, limit: 100, item_ids: $itemIds) { created_at data entity event } } }`,
      { variables: { boardIds, itemIds, pageNum } } );
    return response;
  }

  async getItems(boardIds, itemIds, itemWeightColumns) {
    var apiQuery = 'query ($boardIds: [Int]';
    if (itemIds.length > 0) {
      apiQuery += ', $itemIds: [Int]'
    }
    apiQuery = apiQuery + ') { boards (ids:$boardIds) { ';
    if (itemIds.length > 0) {
      apiQuery += 'items(ids: $itemIds)';
    } else {
      apiQuery += 'items(limit: 100)';
    }
    if (itemWeightColumns.length > 0) {
      apiQuery += ' { created_at name id column_values(ids:["' + itemWeightColumns[0] + '"]) { id text } } } }';
    } else {
      apiQuery += ' { created_at name id } } }';
    }

    if (itemIds.length > 0) {
      const response = await monday.api(apiQuery, { variables: {boardIds, itemIds} });
      return response;
    } else {
      const response = await monday.api(apiQuery, { variables: {boardIds: boardIds} });
      return response;
    }
  }

  getDateString = (current_datetime) => {
    let dateString =
      current_datetime.getFullYear() + "-" +
      (current_datetime.getMonth() + 1) + "-" +
      current_datetime.getDate() + " " +
      current_datetime.getHours() + ":" +
      current_datetime.getMinutes() + ":" +
      current_datetime.getSeconds();
    return dateString;
  };

  render() {
    return (
      <div className="App">
        <LineChart
          width={700}
          height={350}
          data={this.state.graphData}
          margin={{
            top: 5, right: 30, left: 20, bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip content={<CustomTooltip/>}/>
          <Legend />
          <Line name="Item Weight"
                type="monotone"
                dataKey="value"
                stroke={this.state.settings.lineColor}
                strokeWidth={parseInt(this.state.settings.strokeWidth)} />
        </LineChart>
      </div>
    );
  }
}

export default App;
